import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getPlanByPriceId, PLANS } from "@/lib/stripe/plans";
import { createServiceRoleClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  // Read raw body BEFORE any parsing — required for signature verification [I-10]
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    // Signature verification failed — return 400 immediately [I-10]
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0].price.id;
      const plan = getPlanByPriceId(priceId);
      const scanLimit = PLANS[plan].scanLimit;

      await supabase
        .from("businesses")
        .update({
          plan,
          scan_limit: scanLimit,
          stripe_subscription_id: sub.id,
          stripe_subscription_status: sub.status,
        })
        .eq("stripe_customer_id", sub.customer as string);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("businesses")
        .update({
          plan: "starter",
          scan_limit: PLANS.starter.scanLimit,
          stripe_subscription_status: "canceled",
        })
        .eq("stripe_customer_id", sub.customer as string);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;
      if (customerId) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();
        if (biz) {
          await supabase.from("notifications").insert({
            business_id: biz.id,
            type: "billing",
            title: "Payment failed",
            message:
              "Your last payment didn't go through. Update your payment method to keep your plan active.",
            metadata: { invoice_id: invoice.id },
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

export const dynamic = "force-dynamic";
