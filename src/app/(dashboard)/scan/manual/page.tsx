"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExtractionReview } from "@/components/scan/ExtractionReview";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ReviewItem } from "@/types/ai";

// Manual entry — NEVER calls Claude API [I-11]
// Does NOT count against monthly scan allowance [I-11]
export default function ManualEntryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [businessId, setBusinessId] = useState<string>("");

  const blankExtraction = {
    supplier_name: null,
    invoice_date: new Date().toISOString().split("T")[0],
    invoice_number: null,
    total_amount: null,
    currency: null,
    confidence: 1.0,
    items: [],
    extraction_notes: null,
    source: "manual" as const,
  };

  const initialItems: ReviewItem[] = [
    {
      id: uuidv4(),
      item_name_raw: "",
      name: "",
      quantity: 1,
      unit: "units",
      unit_price: null,
      total_price: null,
      match_type: "new",
      item_id: null,
      is_deleted: false,
    },
  ];

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [bizRes, supplierRes] = await Promise.all([
        supabase.from("businesses").select("id").eq("owner_id", user.id).single(),
        supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
      ]);

      if (!bizRes.data) { router.push("/login"); return; }
      setBusinessId(bizRes.data.id);
      setSuppliers(supplierRes.data ?? []);
      setLoading(false);
    }
    init();
  }, [router, supabase]);

  async function handleSave(payload: {
    supplierId: string | null;
    invoiceNumber: string | null;
    scanDate: string;
    items: ReviewItem[];
    totalAmount: number | null;
    aiConfidence: number | null;
    entrySource: "ai_scan" | "manual";
  }) {
    const res = await fetch("/api/scan/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        supplierId: payload.supplierId,
        invoiceNumber: payload.invoiceNumber,
        scanDate: payload.scanDate,
        totalAmount: payload.totalAmount,
        aiConfidence: null,
        manuallyCorreected: false,
        entrySource: "manual",
        items: payload.items.map((item) => ({
          item_id: item.item_id,
          item_name_raw: item.name,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.total_price,
          was_new_item: item.match_type === "new",
          match_type: item.match_type,
        })),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      toast.error("Couldn't save. Try again.");
      return;
    }

    toast.success(`Saved — ${payload.items.length} items updated`);
    router.push("/inventory");
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/scan")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold">Enter manually</h1>
      </div>
      <ExtractionReview
        extraction={blankExtraction}
        initialItems={initialItems}
        suppliers={suppliers}
        onSave={handleSave}
        entrySource="manual"
      />
    </div>
  );
}
