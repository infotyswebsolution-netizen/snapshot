"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Check, X } from "lucide-react";
import type { ReviewItem } from "@/types/ai";

const UNIT_OPTIONS = [
  "kg", "g", "lbs", "oz", "litres", "ml", "units", "each",
  "cases", "boxes", "bags", "cans", "bottles", "loaves", "dozen",
  "sheets", "rolls",
];

interface ItemMatchRowProps {
  item: ReviewItem;
  onChange: (updated: ReviewItem) => void;
  onDelete: () => void;
  suggestedItemName?: string;
  onAcceptMatch?: () => void;
  onRejectMatch?: () => void;
}

export function ItemMatchRow({
  item,
  onChange,
  onDelete,
  suggestedItemName,
  onAcceptMatch,
  onRejectMatch,
}: ItemMatchRowProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (item.is_deleted) {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-gray-100 opacity-40">
        <span className="flex-1 text-sm line-through text-gray-400">
          {item.name}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-blue-600"
          onClick={() => onChange({ ...item, is_deleted: false })}
        >
          Undo
        </Button>
      </div>
    );
  }

  const matchBadge =
    item.match_type === "exact" ? (
      <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
        In stock ✓
      </Badge>
    ) : item.match_type === "fuzzy" ? (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
        Possible match
      </Badge>
    ) : item.match_type === "new" ? (
      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        New item
      </Badge>
    ) : null;

  return (
    <div className="py-3 border-b border-gray-100">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
              className="h-9 text-sm font-medium"
              placeholder="Item name"
            />
            {matchBadge}
          </div>

          {item.match_type === "fuzzy" && suggestedItemName && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <span>Is this &quot;{suggestedItemName}&quot;?</span>
              <button
                className="flex items-center gap-1 font-medium text-green-700 hover:underline"
                onClick={onAcceptMatch}
              >
                <Check className="h-3 w-3" /> Yes
              </button>
              <button
                className="flex items-center gap-1 font-medium text-red-600 hover:underline"
                onClick={onRejectMatch}
              >
                <X className="h-3 w-3" /> No
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Qty</label>
              <Input
                type="number"
                min="0"
                step="any"
                value={item.quantity}
                onChange={(e) =>
                  onChange({ ...item, quantity: parseFloat(e.target.value) || 0 })
                }
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Unit</label>
              <select
                className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm bg-white"
                value={item.unit || ""}
                onChange={(e) => onChange({ ...item, unit: e.target.value })}
              >
                <option value="">—</option>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Price</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price ?? ""}
                placeholder="—"
                onChange={(e) =>
                  onChange({
                    ...item,
                    unit_price: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="h-9 text-sm"
              />
            </div>
          </div>

          {item.confidence_note && (
            <p className="text-xs text-amber-600">{item.confidence_note}</p>
          )}
        </div>

        <div>
          {showConfirmDelete ? (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs"
                onClick={() => {
                  onChange({ ...item, is_deleted: true });
                  setShowConfirmDelete(false);
                }}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setShowConfirmDelete(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-gray-300 hover:text-red-400"
              onClick={() => setShowConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
