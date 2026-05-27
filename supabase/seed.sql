-- Development seed data — creates a test business and supplier
-- Run after migrations: supabase db seed

-- Note: auth.users must be created via Supabase Auth first.
-- Replace the UUID below with an actual user ID from your auth.users table.

DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000001'; -- replace with real user ID
  v_business_id UUID;
  v_supplier_id UUID;
BEGIN
  -- Create test business
  INSERT INTO businesses (owner_id, name, type, plan, onboarding_completed_at)
  VALUES (v_user_id, 'The Corner Cafe', 'cafe', 'growth', NOW())
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_business_id;

  IF v_business_id IS NULL THEN
    SELECT id INTO v_business_id FROM businesses WHERE owner_id = v_user_id LIMIT 1;
  END IF;

  -- Create test supplier
  INSERT INTO suppliers (business_id, name, phone, email)
  VALUES (v_business_id, 'Gordon Food Service', '1-800-968-4877', 'orders@gfs.com')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_supplier_id;

  IF v_supplier_id IS NULL THEN
    SELECT id INTO v_supplier_id FROM suppliers WHERE business_id = v_business_id LIMIT 1;
  END IF;

  -- Create test inventory items
  INSERT INTO items (business_id, name, unit, current_quantity, low_stock_threshold, preferred_supplier_id)
  VALUES
    (v_business_id, 'Whole Milk', 'litres', 24, 8, v_supplier_id),
    (v_business_id, 'All-Purpose Flour', 'kg', 15, 5, v_supplier_id),
    (v_business_id, 'White Sugar', 'kg', 8, 3, v_supplier_id),
    (v_business_id, 'Butter Unsalted', 'kg', 4.5, 2, v_supplier_id),
    (v_business_id, 'Large Eggs', 'dozen', 5, 2, v_supplier_id),
    (v_business_id, 'Arabica Coffee Beans', 'kg', 6, 2, v_supplier_id),
    (v_business_id, 'Vanilla Extract', 'ml', 500, 100, v_supplier_id),
    (v_business_id, 'Baking Powder', 'g', 400, 100, v_supplier_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed complete. Business ID: %', v_business_id;
END $$;
