"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type BusinessType =
  | "restaurant"
  | "cafe"
  | "retail"
  | "pharmacy"
  | "salon"
  | "food_truck"
  | "other";

const BUSINESS_TYPES: { value: BusinessType; label: string; emoji: string }[] =
  [
    { value: "restaurant", label: "Restaurant", emoji: "🍽️" },
    { value: "cafe", label: "Café", emoji: "☕" },
    { value: "retail", label: "Retail", emoji: "🛍️" },
    { value: "pharmacy", label: "Pharmacy", emoji: "💊" },
    { value: "salon", label: "Salon", emoji: "✂️" },
    { value: "food_truck", label: "Food Truck", emoji: "🚚" },
    { value: "other", label: "Other", emoji: "🏪" },
  ];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    businessType: "" as BusinessType | "",
    country: "CA",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    supplierName: "",
    supplierPhone: "",
  });

  async function handleFinish() {
    if (!form.businessName || !form.supplierName) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .insert({
        owner_id: user.id,
        name: form.businessName,
        type: (form.businessType as BusinessType) || null,
        country: form.country,
        timezone: form.timezone,
        onboarding_completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (bizError || !business) {
      toast.error("Couldn't save your business. Try again.");
      setLoading(false);
      return;
    }

    await supabase.from("suppliers").insert({
      business_id: business.id,
      name: form.supplierName,
      phone: form.supplierPhone || null,
    });

    router.push("/scan");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <div className="flex gap-1 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Step {step} of 3
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">What's your business called?</h1>
              <p className="text-gray-500 mt-1 text-sm">
                This shows in your inventory reports.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Business name</Label>
              <Input
                className="h-12 text-base"
                placeholder="The Corner Café"
                value={form.businessName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, businessName: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>What type of business?</Label>
              <div className="grid grid-cols-2 gap-2">
                {BUSINESS_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, businessType: t.value }))
                    }
                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${
                      form.businessType === t.value
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span>{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full h-12 text-base"
              disabled={!form.businessName}
              onClick={() => setStep(2)}
            >
              Continue →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Where are you located?</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Used for currency and date formatting.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <select
                className="w-full h-12 px-3 rounded-lg border border-gray-200 text-base bg-white"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
              >
                <option value="CA">Canada</option>
                <option value="US">United States</option>
                <option value="AU">Australia</option>
                <option value="GB">United Kingdom</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input
                className="h-12 text-base"
                value={form.timezone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, timezone: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button className="flex-1 h-12 text-base" onClick={() => setStep(3)}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Who's your main supplier?</h1>
              <p className="text-gray-500 mt-1 text-sm">
                You can add more later. This gets you started.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Supplier name</Label>
              <Input
                className="h-12 text-base"
                placeholder="Gordon Food Service"
                value={form.supplierName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supplierName: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Phone{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                className="h-12 text-base"
                type="tel"
                placeholder="1-800-000-0000"
                value={form.supplierPhone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supplierPhone: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-12 text-base"
                disabled={!form.supplierName || loading}
                onClick={handleFinish}
              >
                {loading ? "Setting up..." : "Start scanning →"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
