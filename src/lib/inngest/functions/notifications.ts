import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const lowStockNotificationFn = inngest.createFunction(
  { id: "inventory-low-stock-notify", retries: 2, triggers: [{ event: "inventory/low-stock" as const }] },
  async ({ event, step }) => {
    const { businessId, itemIds } = event.data as { businessId: string; itemIds: string[] };

    await step.run("create-notifications", async () => {
      const supabase = createServiceRoleClient();

      const { data: items } = await supabase
        .from("items")
        .select("id, name, current_quantity, low_stock_threshold, unit")
        .in("id", itemIds)
        .eq("business_id", businessId);

      if (!items?.length) return;

      await supabase.from("notifications").insert(
        items.map((item) => ({
          business_id: businessId,
          type: "low_stock" as const,
          title: `${item.name} is running low`,
          message: `Only ${item.current_quantity} ${item.unit ?? "units"} left. Time to reorder.`,
          metadata: {
            item_id: item.id,
            quantity: item.current_quantity,
            threshold: item.low_stock_threshold,
          },
        }))
      );
    });

    return { success: true };
  }
);
