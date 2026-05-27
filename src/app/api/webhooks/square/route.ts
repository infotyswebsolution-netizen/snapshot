import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-square-hmacsha256-signature") ?? "";

  // Verify HMAC signature — reject invalid requests [I-9] [I-10 pattern]
  const url =
    process.env.NEXT_PUBLIC_APP_URL + "/api/webhooks/square";
  const hmac = crypto.createHmac(
    "sha256",
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!
  );
  hmac.update(url + rawBody);
  const expectedSig = hmac.digest("base64");

  const sigValid =
    signature.length === expectedSig.length &&
    crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );

  if (!sigValid) {
    // Return 200 to avoid tipping off attackers; log for monitoring
    console.error("[webhook/square] signature verification failed");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  let event: { type: string; merchant_id: string; event_id: string; data?: { object?: { counts?: Array<{ catalog_object_id: string; location_id: string; quantity: string }> } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (event.type === "inventory.count.updated") {
    const counts = event.data?.object?.counts ?? [];
    // Enqueue to Inngest — handler returns 200 fast [I-9]
    await inngest.send(
      counts.map((count) => ({
        name: "pos/square-inventory-update" as const,
        data: {
          squareMerchantId: event.merchant_id,
          squareItemId: count.catalog_object_id,
          locationId: count.location_id,
          newQuantity: parseFloat(count.quantity ?? "0"),
          eventId: event.event_id,
        },
      }))
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export const dynamic = "force-dynamic";
