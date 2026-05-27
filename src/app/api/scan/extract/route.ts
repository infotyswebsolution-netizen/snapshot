import { createServerClient } from "@/lib/supabase/server";
import { extractBillData } from "@/lib/ai/extract";
import { NextRequest, NextResponse } from "next/server";

const FALLBACK_EXTRACTION = {
  supplier_name: null,
  invoice_date: null,
  invoice_number: null,
  total_amount: null,
  currency: null,
  confidence: 0,
  items: [],
  extraction_notes:
    "Could not read this image. Please enter items manually.",
};

export async function POST(req: NextRequest) {
  // Independent auth check — middleware is not sufficient [I-8]
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, plan, scans_used_this_month, scan_limit, scan_reset_at")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  let body: { image?: string; mediaType?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Manual mode — no Claude call, no scan increment [I-11]
  if (body.mode === "manual") {
    return NextResponse.json({
      success: true,
      businessId: business.id,
      extraction: {
        ...FALLBACK_EXTRACTION,
        confidence: 1.0,
        extraction_notes: null,
        source: "manual",
      },
    });
  }

  // AI scan path — check monthly limit
  const today = new Date().toISOString().split("T")[0];
  const resetMonth = business.scan_reset_at?.substring(0, 7);
  const currentMonth = today.substring(0, 7);

  if (resetMonth && resetMonth < currentMonth) {
    await supabase
      .from("businesses")
      .update({ scans_used_this_month: 0, scan_reset_at: today })
      .eq("id", business.id);
    business.scans_used_this_month = 0;
  }

  if (
    business.scan_limit < 999999 &&
    business.scans_used_this_month >= business.scan_limit
  ) {
    return NextResponse.json(
      {
        error: "scan_limit_reached",
        message:
          "Monthly scan limit reached. Upgrade to Growth for unlimited scans.",
        current: business.scans_used_this_month,
        limit: business.scan_limit,
      },
      { status: 429 }
    );
  }

  const imageBase64 = body.image;
  if (!imageBase64 || imageBase64.length < 100) {
    return NextResponse.json({ error: "No image data" }, { status: 400 });
  }

  const mediaType = (body.mediaType as "image/jpeg" | "image/png" | "image/webp") ?? "image/jpeg";

  // Call Claude API — imageBase64 goes in, never stored [I-5]
  const { success, extraction } = await extractBillData(imageBase64, mediaType);
  // imageBase64 is no longer referenced after this point

  // Increment scan counter async — not on critical path [I-1]
  supabase
    .from("businesses")
    .update({ scans_used_this_month: business.scans_used_this_month + 1 })
    .eq("id", business.id)
    .then(() => {});

  return NextResponse.json({
    success,
    businessId: business.id,
    extraction,
  });
}
