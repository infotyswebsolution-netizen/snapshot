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
