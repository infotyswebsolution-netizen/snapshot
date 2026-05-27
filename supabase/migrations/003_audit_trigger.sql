-- Auto-audit trigger for items.current_quantity changes
-- This is the safety net. Application code also writes explicit audit entries.

CREATE OR REPLACE FUNCTION trg_item_quantity_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_quantity IS DISTINCT FROM NEW.current_quantity THEN
    INSERT INTO inventory_audit_log (
      business_id,
      item_id,
      item_name,
      change_type,
      quantity_before,
      quantity_change,
      quantity_after,
      notes
    ) VALUES (
      NEW.business_id,
      NEW.id,
      NEW.name,
      'system_reset',
      OLD.current_quantity,
      NEW.current_quantity - OLD.current_quantity,
      NEW.current_quantity,
      'trigger-generated; application context missing'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_items_quantity_audit
  AFTER UPDATE OF current_quantity ON items
  FOR EACH ROW EXECUTE FUNCTION trg_item_quantity_audit();

-- =====================================================
-- save_scan: atomic scan save with advisory locks
-- =====================================================
CREATE OR REPLACE FUNCTION save_scan(
  p_business_id        UUID,
  p_supplier_id        UUID,
  p_invoice_number     TEXT,
  p_scan_date          DATE,
  p_total_amount       NUMERIC,
  p_ai_confidence      NUMERIC,
  p_manually_corrected BOOLEAN,
  p_entry_source       TEXT,
  p_items              JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scan_id         UUID;
  v_item            JSONB;
  v_item_id         UUID;
  v_quantity_before NUMERIC;
  v_quantity_after  NUMERIC;
  v_low_stock_items UUID[] := '{}';
  v_items_created   UUID[] := '{}';
  v_items_updated   UUID[] := '{}';
BEGIN
  INSERT INTO scans (
    business_id, supplier_id, invoice_number,
    scan_date, total_amount, ai_confidence,
    manually_corrected, item_count, status, entry_source
  ) VALUES (
    p_business_id, p_supplier_id, p_invoice_number,
    p_scan_date, p_total_amount, p_ai_confidence,
    p_manually_corrected, jsonb_array_length(p_items), 'confirmed', p_entry_source
  )
  RETURNING id INTO v_scan_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'was_new_item')::BOOLEAN THEN
      INSERT INTO items (
        business_id, name, unit, current_quantity,
        preferred_supplier_id, last_unit_price
      ) VALUES (
        p_business_id,
        v_item->>'name',
        v_item->>'unit',
        (v_item->>'quantity')::NUMERIC,
        p_supplier_id,
        (v_item->>'unit_price')::NUMERIC
      )
      RETURNING id INTO v_item_id;

      v_items_created := array_append(v_items_created, v_item_id);
      v_quantity_before := 0;
      v_quantity_after := (v_item->>'quantity')::NUMERIC;
    ELSE
      v_item_id := (v_item->>'item_id')::UUID;

      -- Advisory lock prevents concurrent mutation on same item [I-2]
      PERFORM pg_advisory_xact_lock(hashtext(v_item_id::TEXT));

      SELECT current_quantity INTO v_quantity_before
      FROM items
      WHERE id = v_item_id AND business_id = p_business_id
      FOR UPDATE;

      v_quantity_after := v_quantity_before + (v_item->>'quantity')::NUMERIC;

      UPDATE items SET
        current_quantity = v_quantity_after,
        last_unit_price = COALESCE((v_item->>'unit_price')::NUMERIC, last_unit_price),
        preferred_supplier_id = COALESCE(p_supplier_id, preferred_supplier_id),
        updated_at = NOW()
      WHERE id = v_item_id AND business_id = p_business_id;

      v_items_updated := array_append(v_items_updated, v_item_id);

      IF EXISTS (
        SELECT 1 FROM items
        WHERE id = v_item_id
          AND low_stock_threshold IS NOT NULL
          AND v_quantity_after <= low_stock_threshold
      ) THEN
        v_low_stock_items := array_append(v_low_stock_items, v_item_id);
      END IF;
    END IF;

    INSERT INTO scan_items (
      scan_id, item_id, item_name_raw, quantity,
      unit, unit_price, total_price, was_new_item, match_type
    ) VALUES (
      v_scan_id, v_item_id, v_item->>'item_name_raw',
      (v_item->>'quantity')::NUMERIC,
      v_item->>'unit',
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'total_price')::NUMERIC,
      (v_item->>'was_new_item')::BOOLEAN,
      v_item->>'match_type'
    );

    INSERT INTO inventory_audit_log (
      business_id, item_id, item_name,
      change_type, quantity_before, quantity_change,
      quantity_after, source_ref, notes
    ) VALUES (
      p_business_id, v_item_id, v_item->>'name',
      'scan_add', v_quantity_before,
      (v_item->>'quantity')::NUMERIC,
      v_quantity_after, v_scan_id::TEXT,
      'Bill scan: ' || COALESCE(p_invoice_number, 'no invoice number')
    );
  END LOOP;

  RETURN jsonb_build_object(
    'scan_id', v_scan_id,
    'items_created', v_items_created,
    'items_updated', v_items_updated,
    'low_stock_items', v_low_stock_items
  );
END;
$$;

-- =====================================================
-- update_item_quantity_pos: POS sale deduction with advisory lock
-- =====================================================
CREATE OR REPLACE FUNCTION update_item_quantity_pos(
  p_item_id      UUID,
  p_business_id  UUID,
  p_new_quantity NUMERIC,
  p_source_pos   TEXT,
  p_source_ref   TEXT,
  p_change_type  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quantity_before NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_item_id::TEXT));

  SELECT current_quantity INTO v_quantity_before
  FROM items
  WHERE id = p_item_id AND business_id = p_business_id
  FOR UPDATE;

  UPDATE items SET
    current_quantity = p_new_quantity,
    updated_at = NOW()
  WHERE id = p_item_id AND business_id = p_business_id;

  INSERT INTO inventory_audit_log (
    business_id, item_id, item_name,
    change_type, quantity_before, quantity_change,
    quantity_after, source_ref, source_pos
  )
  SELECT
    p_business_id, p_item_id, name,
    p_change_type, v_quantity_before,
    p_new_quantity - v_quantity_before,
    p_new_quantity, p_source_ref, p_source_pos
  FROM items WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'quantity_before', v_quantity_before,
    'quantity_after', p_new_quantity
  );
END;
$$;
