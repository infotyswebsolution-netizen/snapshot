import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ChangeType } from "@/types/app";

interface MutationResult {
  success: boolean;
  quantity_after: number;
}

// All quantity mutations route through this — enforces advisory lock via DB function
export async function updateItemQuantity(
  supabase: SupabaseClient<Database>,
  params: {
    itemId: string;
    businessId: string;
    newQuantity: number;
    changeType: ChangeType;
    sourcePOS?: string;
    sourceRef?: string;
    notes?: string;
  }
): Promise<MutationResult> {
  const { data, error } = await supabase.rpc("update_item_quantity_pos", {
    p_item_id: params.itemId,
    p_business_id: params.businessId,
    p_new_quantity: params.newQuantity,
    p_source_pos: params.sourcePOS ?? "",
    p_source_ref: params.sourceRef ?? "",
    p_change_type: params.changeType,
  });

  if (error) throw new Error(`Quantity mutation failed: ${error.message}`);

  return data as unknown as MutationResult;
}
