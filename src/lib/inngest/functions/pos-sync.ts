import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/pos/tokens";
import { getSquareCatalog } from "@/lib/pos/square";

export const squareInventoryUpdateFn = inngest.createFunction(
  {
    id: "pos-square-inventory-update",
    retries: 3,
    idempotency: "event.data.eventId",
    triggers: [{ event: "pos/square-inventory-update" as const }],
  },
  async ({ event, step }) => {
    const { squareMerchantId, squareItemId, newQuantity, eventId } = event.data;

    const business = await step.run("find-business", async () => {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from("pos_connections")
        .select("business_id")
        .eq("pos_type", "square")
        .eq("merchant_id", squareMerchantId)
        .eq("is_active", true)
        .single();
      return data;
    });

    if (!business) return { skipped: "merchant not found in SnapStock" };

    const item = await step.run("find-item", async () => {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from("items")
        .select("id, name, current_quantity, low_stock_threshold, unit")
        .eq("business_id", business.business_id)
        .eq("square_item_id", squareItemId)
        .single();
      return data;
    });

    if (!item) return { skipped: "item not mapped to SnapStock" };

    await step.run("update-quantity", async () => {
      const supabase = createServiceRoleClient();
      await supabase.rpc("update_item_quantity_pos", {
        p_item_id: item.id,
        p_business_id: business.business_id,
        p_new_quantity: newQuantity,
        p_source_pos: "square",
        p_source_ref: eventId,
        p_change_type: "pos_sale_deduct",
      });
    });

    if (
      item.low_stock_threshold !== null &&
      newQuantity <= item.low_stock_threshold
    ) {
      await step.run("notify-low-stock", async () => {
        const supabase = createServiceRoleClient();
        await supabase.from("notifications").insert({
          business_id: business.business_id,
          type: "low_stock",
          title: `${item.name} is running low`,
          message: `You have ${newQuantity} ${item.unit ?? "units"} remaining.`,
          metadata: { item_id: item.id, quantity: newQuantity },
        });
      });
    }

    return { success: true, itemId: item.id, newQuantity };
  }
);

export const squareCatalogSyncFn = inngest.createFunction(
  { id: "pos-square-catalog-sync", retries: 2, triggers: [{ event: "pos/square-catalog-sync" as const }] },
  async ({ event, step }) => {
    const { businessId } = event.data;

    const accessToken = await step.run("get-token", async () => {
      const supabase = createServiceRoleClient();
      return getValidAccessToken(supabase, businessId, "square");
    });

    if (!accessToken) return { error: "No valid Square token" };

    const catalog = await step.run("fetch-catalog", async () => {
      return getSquareCatalog(accessToken);
    });

    await step.run("sync-items", async () => {
      const supabase = createServiceRoleClient();
      const items = catalog.objects ?? [];

      for (const obj of items) {
        if (obj.type !== "ITEM") continue;
        const itemData = obj.item_data;
        await supabase
          .from("items")
          .upsert(
            {
              business_id: businessId,
              name: itemData.name,
              square_item_id: obj.id,
              is_active: true,
            },
            { onConflict: "square_item_id" }
          );
      }

      await supabase
        .from("pos_connections")
        .update({ catalog_synced_at: new Date().toISOString(), last_sync_status: "success" })
        .eq("business_id", businessId)
        .eq("pos_type", "square");
    });

    return { success: true };
  }
);
