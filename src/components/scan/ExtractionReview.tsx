"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfidenceBanner } from "./ConfidenceBanner";
import { ItemMatchRow } from "./ItemMatchRow";
import { Plus, Loader2 } from "lucide-react";
import type { ReviewItem, ExtractionResult } from "@/types/ai";
import { formatCurrency } from "@/lib/utils/format";
import { v4 as uuidv4 } from "uuid";

interface ExtractionReviewProps {
  extraction: ExtractionResult;
  initialItems: ReviewItem[];
  suppliers: { id: string; name: string }[];
  defaultSupplierId?: string;
  onSave: (payload: {
    supplierId: string | null;
    invoiceNumber: string | null;
    scanDate: string;
    items: ReviewItem[];
    totalAmount: number | null;
    aiConfidence: number | null;
    entrySource: "ai_scan" | "manual";
  }) => Promise<void>;
  entrySource: "ai_scan" | "manual";
}

export function ExtractionReview({
  extraction,
  initialItems,
  suppliers,
  defaultSupplierId,
  onSave,
  entrySource,
}: ExtractionReviewProps) {
  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(
    extraction.invoice_number ?? ""
  );
  const [scanDate, setScanDate] = useState(
    extraction.invoice_date ?? new Date().toISOString().split("T")[0]
  );
  const [saving, setSaving] = useState(false);

  const activeItems = items.filter((i) => !i.is_deleted);
  const pendingFuzzy = activeItems.filter((i) => i.match_type === "fuzzy");

  const totalAmount = useMemo(() => {
    return activeItems.reduce((sum, item) => {
      if (item.total_price) return sum + item.total_price;
      if (item.unit_price && item.quantity) return sum + item.unit_price * item.quantity;
      return sum;
    }, 0) || null;
  }, [activeItems]);

  function updateItem(id: string, updated: ReviewItem) {
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  function addBlankRow() {
    setItems((prev) => [
      ...prev,
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
    ]);
  }

  async function handleSave() {
    if (pendingFuzzy.length > 0) return;
    const valid = activeItems.filter((i) => i.name.trim() && i.quantity > 0);
    if (valid.length === 0) return;

    setSaving(true);
    await onSave({
      supplierId: supplierId || null,
      invoiceNumber: invoiceNumber || null,
      scanDate,
      items: valid,
      totalAmount,
      aiConfidence: entrySource === "ai_scan" ? extraction.confidence : null,
      entrySource,
    });
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {entrySource === "ai_scan" && (
        <ConfidenceBanner
          confidence={extraction.confidence}
          notes={extraction.extraction_notes}
        />
      )}

      {/* Header fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-gray-500">Supplier</Label>
          <select
            className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Date</Label>
            <Input
              type="date"
              className="h-10 text-sm"
              value={scanDate}
              onChange={(e) => setScanDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Invoice # (optional)</Label>
            <Input
              className="h-10 text-sm"
              placeholder="INV-12345"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Item rows */}
      <div className="bg-white rounded-xl border border-gray-200 px-4">
        {items.map((item) => (
          <ItemMatchRow
            key={item.id}
            item={item}
            onChange={(updated) => updateItem(item.id, updated)}
            onDelete={() =>
              updateItem(item.id, { ...item, is_deleted: true })
            }
            onAcceptMatch={() =>
              updateItem(item.id, { ...item, match_type: "manual" })
            }
            onRejectMatch={() =>
              updateItem(item.id, {
                ...item,
                match_type: "new",
                item_id: null,
              })
            }
          />
        ))}

        <button
          onClick={addBlankRow}
          className="flex items-center gap-2 py-3 text-sm text-blue-600 font-medium hover:text-blue-700 w-full"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </div>

      {pendingFuzzy.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          Please confirm or dismiss the {pendingFuzzy.length} highlighted item
          {pendingFuzzy.length > 1 ? "s" : ""} before saving.
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 lg:relative lg:bottom-auto bg-white border-t border-gray-100 lg:border-0 p-4 lg:p-0 safe-area-pb z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{activeItems.length}</span>{" "}
            items
            {totalAmount ? (
              <> · {formatCurrency(totalAmount, "CAD")}</>
            ) : null}
          </div>
          <Button
            className="h-12 px-8 text-base"
            onClick={handleSave}
            disabled={
              saving ||
              activeItems.filter((i) => i.name.trim() && i.quantity > 0)
                .length === 0 ||
              pendingFuzzy.length > 0
            }
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save to inventory →"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
