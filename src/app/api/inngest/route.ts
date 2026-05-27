import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { squareInventoryUpdateFn, squareCatalogSyncFn } from "@/lib/inngest/functions/pos-sync";
import { lowStockNotificationFn } from "@/lib/inngest/functions/notifications";
import { lightspeedPollFn } from "@/lib/inngest/functions/pos-poll";
import { posPushAdjustmentFn } from "@/lib/inngest/functions/pos-push";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    squareInventoryUpdateFn,
    squareCatalogSyncFn,
    lowStockNotificationFn,
    lightspeedPollFn,
    posPushAdjustmentFn,
  ],
});
