import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Clover uses HMAC-SHA256 with the app secret
  const signature = req.headers.get("x-clover-request-signature") ?? "";
  const expected = crypto
    .createHmac("sha256", process.env.CLOVER_APP_SECRET!)
    .update(rawBody)
    .digest("base64");

  const sigValid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!sigValid) {
    console.error("[webhook/clover] signature verification failed");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  let event: { type?: string; merchantId?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (event.type === "INVENTORY_UPDATE" && event.merchantId) {
    await inngest.send({
      name: "pos/clover-inventory-update",
      data: {
        cloverMerchantId: event.merchantId,
        eventData: event.data,
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export const dynamic = "force-dynamic";
