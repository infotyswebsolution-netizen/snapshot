"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExtractionReview } from "@/components/scan/ExtractionReview";
import { findBestMatch } from "@/lib/inventory/matching";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ExtractionResult, ReviewItem } from "@/types/ai";

interface SavePayload {
  supplierId: string | null;
  invoiceNumber: string | null;
  scanDate: string;
  items: ReviewItem[];
  totalAmount: number | null;
  aiConfidence: number | null;
  entrySource: "ai_scan" | "manual";
}

export default function ReviewPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [initialItems, setInitialItems] = useState<ReviewItem[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [defaultSupplierId, setDefaultSupplierId] = useState<string>("");
  const [businessId, setBusinessId] = useState<string>("");

  useEffect(() => {
    async function init() {
      // Load cached extraction from session storage [I-4] [I-5]
      const cacheKey = sessionStorage.getItem("last_extraction_key");
      const cacheTs = sessionStorage.getItem("last_extraction_ts");
      const isRecent = cacheTs && Date.now() - parseInt(cacheTs) < 30 * 60 * 1000;

      let extractionData: { success: boolean; extraction: ExtractionResult } | null = null;
      if (cacheKey && isRecent) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) extractionData = JSON.parse(cached);
      }

      if (!extractionData) {
        // No cached extraction — redirect back to scan
        router.push("/scan");
        return;
      }

      const ext = extractionData.extraction;
      setExtraction(ext);

      // Get business + suppliers
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [bizRes, supplierRes, itemsRes] = await Promise.all([
        supabase.from("businesses").select("id").eq("owner_id", user.id).single(),
        supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("items").select("id, name").eq("is_active", true),
      ]);

      const biz = bizRes.data;
      if (!biz) { router.push("/login"); return; }

      setBusinessId(biz.id);
      const supplierList = supplierRes.data ?? [];
      setSuppliers(supplierList);

      // Try to match supplier name from extraction
      if (ext.supplier_name) {
        const match = supplierList.find((s) =>
          s.name.toLowerCase().includes(ext.supplier_name!.toLowerCase().substring(0, 8))
        );
        if (match) setDefaultSupplierId(match.id);
      }

      // Match extracted items against existing inventory
      const existingItems = itemsRes.data ?? [];
      const reviewItems: ReviewItem[] = ext.items.map((item) => {
        const matchResult = findBestMatch(item.name, existingItems);
        return {
          id: uuidv4(),
          item_name_raw: item.name,
          name: matchResult?.itemName ?? item.name,
          quantity: item.quantity,
          unit: item.unit ?? "units",
          unit_price: item.unit_price,
          total_price: item.total_price,
          match_type: matchResult?.matchType ?? "new",
          item_id: matchResult?.itemId ?? null,
          is_deleted: false,
          confidence_note: item.confidence_note,
        };
      });

      setInitialItems(reviewItems);
      setLoading(false);
    }

    init();
  }, [router, supabase]);

  async function handleSave(payload: SavePayload) {
    const res = await fetch("/api/scan/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        supplierId: payload.supplierId,
        invoiceNumber: payload.invoiceNumber,
        scanDate: payload.scanDate,
        totalAmount: payload.totalAmount,
        aiConfidence: payload.aiConfidence,
        manuallyCorreected: extraction?.confidence !== null && payload.items.some(i => i.match_type === "manual"),
        entrySource: payload.entrySource,
        items: payload.items.map((item) => ({
          item_id: item.item_id,
          item_name_raw: item.item_name_raw || item.name,
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

    // Clear session cache
    const cacheKey = sessionStorage.getItem("last_extraction_key");
    if (cacheKey) sessionStorage.removeItem(cacheKey);
    sessionStorage.removeItem("last_extraction_key");
    sessionStorage.removeItem("last_extraction_ts");

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

  if (!extraction) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/scan")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold">Review and save</h1>
      </div>
      <ExtractionReview
        extraction={extraction}
        initialItems={initialItems}
        suppliers={suppliers}
        defaultSupplierId={defaultSupplierId}
        onSave={handleSave}
        entrySource="ai_scan"
      />
    </div>
  );
}
