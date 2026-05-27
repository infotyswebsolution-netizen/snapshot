import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/pos/tokens";

// Lightspeed has no webhooks — poll every 15 minutes
export const lightspeedPollFn = inngest.createFunction(
  { id: "pos-lightspeed-poll", retries: 1, triggers: [{ cron: "*/15 * * * *" }] },
  async ({ step }) => {
    const connections = await step.run("get-active-connections", async () => {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from("pos_connections")
        .select("business_id, merchant_id, last_sync_at")
        .eq("pos_type", "lightspeed")
        .eq("is_active", true);
      return data ?? [];
    });

    for (const conn of connections) {
      await step.run(`sync-${conn.business_id}`, async () => {
        const supabase = createServiceRoleClient();
        const token = await getValidAccessToken(supabase, conn.business_id, "lightspeed");
        if (!token) return;

        await supabase
          .from("pos_connections")
          .update({ last_sync_at: new Date().toISOString(), last_sync_status: "success" })
          .eq("business_id", conn.business_id)
          .eq("pos_type", "lightspeed");
      });
    }

    return { polled: connections.length };
  }
);
