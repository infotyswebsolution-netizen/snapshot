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
