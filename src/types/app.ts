export type Plan = "starter" | "growth" | "pro";

export type ScanStatus = "pending" | "confirmed" | "failed";

export type ScanEntrySource = "ai_scan" | "manual" | "template_reuse" | "pos_import";

export type ChangeType =
  | "scan_add"
  | "manual_add"
  | "manual_edit"
  | "manual_delete"
  | "pos_sale_deduct"
  | "pos_sync_adjust"
  | "pos_catalog_create"
  | "system_reset";

export interface PlanConfig {
  name: string;
  price: number;
  currency: string;
  scanLimit: number;
  posSync: boolean;
  multiLocation: boolean;
  csvExport?: boolean;
  stripePriceId: string;
  features: string[];
}

export interface BusinessWithPlan {
  id: string;
  name: string;
  plan: Plan;
  scans_used_this_month: number;
  scan_limit: number;
  stripe_customer_id: string | null;
  stripe_subscription_status: string | null;
  onboarding_completed_at: string | null;
  currency: string;
  timezone: string;
}

export interface LowStockItem {
  id: string;
  name: string;
  current_quantity: number;
  low_stock_threshold: number;
  unit: string | null;
}
