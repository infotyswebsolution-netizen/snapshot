"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PLANS, formatPriceCad } from "@/lib/stripe/plans";
import { Check, Loader2 } from "lucide-react";
import type { Plan } from "@/types/app";

interface BillingData {
  plan: Plan;
  scansUsed: number;
  scanLimit: number;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
}

export default function BillingPage() {
  const supabase = createClient();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState<Plan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: biz } = await supabase
        .from("businesses")
        .select("plan, scans_used_this_month, scan_limit, stripe_subscription_status, stripe_customer_id")
        .eq("owner_id", user.id)
        .single();
      if (biz) {
        setData({
          plan: biz.plan as Plan,
          scansUsed: biz.scans_used_this_month,
          scanLimit: biz.scan_limit,
          subscriptionStatus: biz.stripe_subscription_status,
          stripeCustomerId: biz.stripe_customer_id,
        });
      }
    }
    load();
  }, [supabase]);

  async function handleUpgrade(plan: Plan) {
    setLoading(plan);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(null);
  }

  async function handlePortal() {
    setPortalLoading(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setPortalLoading(false);
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  const scanPct = data.scanLimit >= 999999 ? 0 : Math.min((data.scansUsed / data.scanLimit) * 100, 100);

  return (
    <div>
      <PageHeader title="Billing" />

      {/* Current plan */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500">Current plan</p>
              <p className="text-xl font-bold capitalize">{data.plan}</p>
            </div>
            {data.stripeCustomerId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePortal}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Manage billing"
                )}
              </Button>
            )}
          </div>

          {data.scanLimit < 999999 && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Scans this month</span>
                <span>
                  {data.scansUsed} / {data.scanLimit}
                </span>
              </div>
              <Progress value={scanPct} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan cards */}
      <div className="space-y-3">
        {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([planKey, plan]) => {
          const isCurrent = data.plan === planKey;
          return (
            <Card
              key={planKey}
              className={isCurrent ? "border-blue-400 bg-blue-50/30" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {plan.name}
                    {isCurrent && (
                      <Badge className="ml-2 bg-blue-100 text-blue-700 border-blue-200 text-xs">
                        Current
                      </Badge>
                    )}
                  </CardTitle>
                  <span className="text-xl font-bold">
                    {formatPriceCad(plan.price)}
                    <span className="text-sm font-normal text-gray-400">/mo</span>
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <Button
                    className="w-full"
                    variant={planKey === "growth" ? "default" : "outline"}
                    onClick={() => handleUpgrade(planKey)}
                    disabled={loading === planKey}
                  >
                    {loading === planKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
