import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/pos/tokens";

export const posPushAdjustmentFn = inngest.createFunction(
  { id: "pos-push-adjustment", retries: 2, triggers: [{ event: "pos/push-adjustment" as const }] },
  async ({ event, step }) => {
    const { businessId, scanId, items } = event.data;

    const connection = await step.run("get-pos-connection", async () => {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from("pos_connections")
        .select("pos_type, merchant_id, location_id")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .single();
      return data;
    });

    if (!connection) return { skipped: "no active POS connection" };

    const accessToken = await step.run("get-token", async () => {
      const supabase = createServiceRoleClient();
      return getValidAccessToken(supabase, businessId, connection.pos_type as "square" | "clover" | "lightspeed");
    });

    if (!accessToken) return { error: "Could not get valid POS token" };

    if (connection.pos_type === "square") {
      await step.run("push-to-square", async () => {
        const supabase = createServiceRoleClient();
        const { data: scanItems } = await supabase
          .from("items")
          .select("id, square_item_id, current_quantity")
          .in("id", items.map((i: { itemId: string }) => i.itemId))
          .not("square_item_id", "is", null);

        if (!scanItems?.length) return;

        const changes = scanItems.map((item) => ({
          catalog_object_id: item.square_item_id,
          location_id: connection.location_id,
          quantity: item.current_quantity.toString(),
          occurred_at: new Date().toISOString(),
          from_state: "IN_STOCK",
          to_state: "IN_STOCK",
        }));

        await fetch("https://connect.squareup.com/v2/inventory/changes/batch-create", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idempotency_key: scanId,
            changes: changes.map((c) => ({
              type: "PHYSICAL_COUNT",
              physical_count: c,
            })),
          }),
        });
      });
    }

    return { success: true };
  }
);
