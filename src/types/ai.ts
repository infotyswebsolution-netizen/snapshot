export interface ExtractionItem {
  name: string;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  confidence_note: string | null;
}

export interface ExtractionResult {
  supplier_name: string | null;
  invoice_date: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  currency: string | null;
  confidence: number;
  items: ExtractionItem[];
  extraction_notes: string | null;
  source?: "ai_scan" | "manual";
}

export type MatchType = "exact" | "fuzzy" | "manual" | "new";

export interface ReviewItem {
  id: string;
  item_name_raw: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  total_price: number | null;
  match_type: MatchType;
  item_id: string | null;
  is_deleted: boolean;
  confidence_note?: string | null;
}
