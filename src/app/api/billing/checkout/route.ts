import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { PLANS } from "@/lib/stripe/plans";
import { NextRequest, NextResponse } from "next/server";
import type { Plan } from "@/types/app";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await req.json() as { plan: Plan };
  if (!plan || !PLANS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, stripe_customer_id, name")
    .eq("owner_id", user.id)
    .single();
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stripe = getStripe();
  let customerId = business.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: business.name,
      metadata: { business_id: business.id, supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase
      .from("businesses")
      .update({ stripe_customer_id: customerId })
      .eq("id", business.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PLANS[plan].stripePriceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    subscription_data: {
      metadata: { business_id: business.id },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
