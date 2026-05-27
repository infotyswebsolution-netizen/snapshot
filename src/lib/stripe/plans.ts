import type { Plan, PlanConfig } from "@/types/app";

export const PLANS: Record<Plan, PlanConfig> = {
  starter: {
    name: "Starter",
    price: 2900,
    currency: "cad",
    scanLimit: 50,
    posSync: false,
    multiLocation: false,
    stripePriceId: process.env.STRIPE_PRICE_STARTER_CAD!,
    features: [
      "50 bill scans per month",
      "Unlimited inventory items",
      "Unlimited suppliers",
      "Low-stock alerts",
      "Mobile bill scanning",
    ],
  },
  growth: {
    name: "Growth",
    price: 5900,
    currency: "cad",
    scanLimit: 999999,
    posSync: true,
    multiLocation: false,
    stripePriceId: process.env.STRIPE_PRICE_GROWTH_CAD!,
    features: [
      "Unlimited bill scans",
      "Square & Clover register sync",
      "Auto inventory update from sales",
      "All Starter features",
    ],
  },
  pro: {
    name: "Pro",
    price: 9900,
    currency: "cad",
    scanLimit: 999999,
    posSync: true,
    multiLocation: true,
    csvExport: true,
    stripePriceId: process.env.STRIPE_PRICE_PRO_CAD!,
    features: [
      "Everything in Growth",
      "Lightspeed register sync",
      "Multi-location support",
      "CSV export",
      "Priority support",
    ],
  },
};

export function getPlanByPriceId(priceId: string): Plan {
  const entry = Object.entries(PLANS).find(
    ([, config]) => config.stripePriceId === priceId
  );
  return (entry?.[0] as Plan) ?? "starter";
}

export function formatPriceCad(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}
