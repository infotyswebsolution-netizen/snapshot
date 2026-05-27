-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- BUSINESSES
-- =====================================================
CREATE TABLE businesses (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  type                     TEXT CHECK (type IN (
                             'restaurant','cafe','retail',
                             'pharmacy','salon','food_truck','other')),
  country                  TEXT NOT NULL DEFAULT 'CA',
  currency                 TEXT NOT NULL DEFAULT 'CAD',
  timezone                 TEXT NOT NULL DEFAULT 'America/Toronto',
  plan                     TEXT NOT NULL DEFAULT 'starter'
                             CHECK (plan IN ('starter','growth','pro')),
  stripe_customer_id       TEXT UNIQUE,
  stripe_subscription_id   TEXT UNIQUE,
  stripe_subscription_status TEXT DEFAULT 'inactive',
  scans_used_this_month    INTEGER NOT NULL DEFAULT 0,
  scan_limit               INTEGER NOT NULL DEFAULT 50,
  scan_reset_at            DATE NOT NULL DEFAULT CURRENT_DATE,
  onboarding_completed_at  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_businesses_owner ON businesses(owner_id);

-- =====================================================
-- SUPPLIERS
-- =====================================================
CREATE TABLE suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_suppliers_business ON suppliers(business_id);

-- =====================================================
-- ITEMS (inventory master catalog)
-- =====================================================
CREATE TABLE items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  category              TEXT,
  unit                  TEXT,
  current_quantity      NUMERIC(12,3) NOT NULL DEFAULT 0,
  low_stock_threshold   NUMERIC(12,3),
  preferred_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  last_unit_price       NUMERIC(10,4),
  avg_unit_price        NUMERIC(10,4),
  square_item_id        TEXT,
  square_location_id    TEXT,
  clover_item_id        TEXT,
  lightspeed_item_id    TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_items_business ON items(business_id);
CREATE INDEX idx_items_name ON items(business_id, name);
CREATE INDEX idx_items_low_stock ON items(business_id, current_quantity)
  WHERE low_stock_threshold IS NOT NULL AND is_active = true;
CREATE INDEX idx_items_square ON items(square_item_id) WHERE square_item_id IS NOT NULL;
CREATE INDEX idx_items_clover ON items(clover_item_id) WHERE clover_item_id IS NOT NULL;

-- =====================================================
-- SCANS
-- =====================================================
CREATE TABLE scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id         UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number      TEXT,
  scan_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount        NUMERIC(10,2),
  currency            TEXT DEFAULT 'CAD',
  item_count          INTEGER NOT NULL DEFAULT 0,
  ai_confidence       NUMERIC(3,2) CHECK (ai_confidence BETWEEN 0 AND 1),
  manually_corrected  BOOLEAN NOT NULL DEFAULT false,
  entry_source        TEXT NOT NULL DEFAULT 'ai_scan'
                      CHECK (entry_source IN ('ai_scan','manual','template_reuse','pos_import')),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','failed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_scans_business_date ON scans(business_id, scan_date DESC);

-- =====================================================
-- SCAN_ITEMS
-- =====================================================
CREATE TABLE scan_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
  item_name_raw   TEXT NOT NULL,
  quantity        NUMERIC(12,3) NOT NULL,
  unit            TEXT,
  unit_price      NUMERIC(10,4),
  total_price     NUMERIC(10,2),
  was_new_item    BOOLEAN NOT NULL DEFAULT false,
  match_type      TEXT CHECK (match_type IN ('exact','fuzzy','manual','new'))
);
CREATE INDEX idx_scan_items_scan ON scan_items(scan_id);
CREATE INDEX idx_scan_items_item ON scan_items(item_id);

-- =====================================================
-- POS_CONNECTIONS
-- =====================================================
CREATE TABLE pos_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pos_type            TEXT NOT NULL CHECK (pos_type IN ('square','clover','lightspeed','toast')),
  merchant_id         TEXT NOT NULL,
  location_id         TEXT,
  access_token_enc    TEXT NOT NULL,
  refresh_token_enc   TEXT,
  token_expires_at    TIMESTAMPTZ,
  scopes              TEXT[],
  last_sync_at        TIMESTAMPTZ,
  last_sync_status    TEXT DEFAULT 'never'
                      CHECK (last_sync_status IN ('never','syncing','success','partial','failed')),
  last_error_message  TEXT,
  catalog_synced_at   TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, pos_type)
);
CREATE INDEX idx_pos_connections_business ON pos_connections(business_id);

-- =====================================================
-- INVENTORY_AUDIT_LOG (append-only)
-- =====================================================
CREATE TABLE inventory_audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_id          UUID REFERENCES items(id) ON DELETE SET NULL,
  item_name        TEXT NOT NULL,
  change_type      TEXT NOT NULL CHECK (change_type IN (
                   'scan_add','manual_add','manual_edit','manual_delete',
                   'pos_sale_deduct','pos_sync_adjust','pos_catalog_create','system_reset')),
  quantity_before  NUMERIC(12,3),
  quantity_change  NUMERIC(12,3) NOT NULL,
  quantity_after   NUMERIC(12,3) NOT NULL,
  source_ref       TEXT,
  source_pos       TEXT,
  notes            TEXT,
  performed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_item_date ON inventory_audit_log(item_id, created_at DESC);
CREATE INDEX idx_audit_business_date ON inventory_audit_log(business_id, created_at DESC);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('low_stock','pos_error','scan_failed','billing')),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  metadata     JSONB,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_business_unread ON notifications(business_id, created_at DESC)
  WHERE read_at IS NULL;

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pos_connections_updated_at
  BEFORE UPDATE ON pos_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Enable RLS on all tables
ALTER TABLE businesses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_connections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_audit_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;

-- BUSINESSES: owner only
CREATE POLICY "businesses: owner all"
  ON businesses FOR ALL
  USING (owner_id = auth.uid());

-- SUPPLIERS
CREATE POLICY "suppliers: owner all"
  ON suppliers FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- ITEMS
CREATE POLICY "items: owner all"
  ON items FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- SCANS
CREATE POLICY "scans: owner all"
  ON scans FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- SCAN_ITEMS
CREATE POLICY "scan_items: owner all"
  ON scan_items FOR ALL
  USING (scan_id IN (
    SELECT s.id FROM scans s
    JOIN businesses b ON s.business_id = b.id
    WHERE b.owner_id = auth.uid()
  ));

-- POS_CONNECTIONS
CREATE POLICY "pos_connections: owner all"
  ON pos_connections FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- AUDIT LOG: INSERT + SELECT only. Intentionally NO UPDATE. Intentionally NO DELETE.
CREATE POLICY "audit_log: owner insert"
  ON inventory_audit_log FOR INSERT
  WITH CHECK (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

CREATE POLICY "audit_log: owner select"
  ON inventory_audit_log FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));

-- NOTIFICATIONS
CREATE POLICY "notifications: owner all"
  ON notifications FOR ALL
  USING (business_id IN (
    SELECT id FROM businesses WHERE owner_id = auth.uid()
  ));


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


-- Supabase Vault setup for POS token encryption [I-6]
-- Uses pgsodium (built into Supabase) for AES-256-GCM encryption

-- Create the encryption key for POS tokens
-- In production: run this once and note the key_id returned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'pos_token_key'
  ) THEN
    PERFORM vault.create_secret(
      'pos-token-encryption-key',
      'pos_token_key',
      'AES-256 key for encrypting POS OAuth tokens'
    );
  END IF;
END $$;

-- Encrypt a plaintext token using vault
CREATE OR REPLACE FUNCTION vault_encrypt_token(plaintext_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id UUID;
  v_encrypted TEXT;
BEGIN
  SELECT id INTO v_key_id FROM vault.secrets WHERE name = 'pos_token_key' LIMIT 1;

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found. Run vault setup migration first.';
  END IF;

  SELECT encode(
    pgsodium.crypto_aead_det_encrypt(
      convert_to(plaintext_token, 'utf8'),
      convert_to('snapstock-pos-token', 'utf8'),
      pgsodium.derive_key(v_key_id::uuid, 64, 'token-encryption')
    ),
    'base64'
  ) INTO v_encrypted;

  RETURN v_encrypted;
END;
$$;

-- Decrypt an encrypted token
CREATE OR REPLACE FUNCTION vault_decrypt_token(encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id UUID;
  v_decrypted TEXT;
BEGIN
  SELECT id INTO v_key_id FROM vault.secrets WHERE name = 'pos_token_key' LIMIT 1;

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found.';
  END IF;

  SELECT convert_from(
    pgsodium.crypto_aead_det_decrypt(
      decode(encrypted_token, 'base64'),
      convert_to('snapstock-pos-token', 'utf8'),
      pgsodium.derive_key(v_key_id::uuid, 64, 'token-encryption')
    ),
    'utf8'
  ) INTO v_decrypted;

  RETURN v_decrypted;
END;
$$;

-- Grant execute only to service role and authenticated users via SECURITY DEFINER
REVOKE ALL ON FUNCTION vault_encrypt_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION vault_decrypt_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vault_encrypt_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION vault_decrypt_token(TEXT) TO service_role;

