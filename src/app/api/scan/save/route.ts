import { createServerClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";
import { NextRequest, NextResponse } from "next/server";

interface SaveItem {
  item_id: string | null;
  item_name_raw: string;
  name: string;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  total_price: number | null;
  was_new_item: boolean;
  match_type: string;
}

interface SavePayload {
  businessId: string;
  supplierId: string | null;
  invoiceNumber: string | null;
  scanDate: string;
  totalAmount: number | null;
  aiConfidence: number | null;
  manuallyCorreected: boolean;
  entrySource: "ai_scan" | "manual" | "template_reuse";
  items: SaveItem[];
}

export async function POST(req: NextRequest) {
  // Independent auth check [I-8]
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SavePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Verify business ownership
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", payload.businessId)
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeItems = payload.items.filter((i) => i.name.trim() && i.quantity > 0);
  if (activeItems.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  // Call the atomic Postgres function — advisory locks + audit log [I-2] [I-7]
  const { data: result, error: rpcError } = await supabase.rpc("save_scan", {
    p_business_id: payload.businessId,
    p_supplier_id: payload.supplierId,
    p_invoice_number: payload.invoiceNumber,
    p_scan_date: payload.scanDate,
    p_total_amount: payload.totalAmount,
    p_ai_confidence: payload.aiConfidence,
    p_manually_corrected: payload.manuallyCorreected ?? false,
    p_entry_source: payload.entrySource ?? "ai_scan",
    p_items: JSON.stringify(activeItems),
  });

  if (rpcError) {
    console.error("[scan/save] RPC error:", rpcError.message);
    return NextResponse.json(
      { error: "Save failed. Try again." },
      { status: 500 }
    );
  }

  const { scan_id, low_stock_items, items_updated } = result as {
    scan_id: string;
    low_stock_items: string[];
    items_updated: string[];
  };

  // Dispatch Inngest events — complete within 3s handler window [I-9]
  const inngestEvents: Promise<unknown>[] = [];

  if (low_stock_items?.length > 0) {
    inngestEvents.push(
      inngest.send({
        name: "inventory/low-stock",
        data: { businessId: payload.businessId, itemIds: low_stock_items },
      })
    );
  }

  if (items_updated?.length > 0) {
    inngestEvents.push(
      inngest.send({
        name: "pos/push-adjustment",
        data: {
          businessId: payload.businessId,
          scanId: scan_id,
          items: items_updated.map((id) => ({ itemId: id })),
        },
      })
    );
  }

  // Fire and forget — don't await (not on critical path)
  Promise.all(inngestEvents).catch((err) =>
    console.error("[scan/save] Inngest dispatch error:", err)
  );

  return NextResponse.json({
    success: true,
    scanId: scan_id,
    itemCount: activeItems.length,
  });
}
