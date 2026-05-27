"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCapture } from "@/components/scan/CameraCapture";
import { Button } from "@/components/ui/button";
import { Camera, PenLine, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type Mode = "choose" | "scan" | "processing";

export default function ScanPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [processingMsg, setProcessingMsg] = useState("");

  async function handleCapture(base64: string, mediaType: "image/jpeg") {
    setMode("processing");
    setProcessingMsg("Reading your bill...");

    // Cache key for deduplication if user navigates back
    const cacheKey = `extraction_${Date.now()}`;

    try {
      const res = await fetch("/api/scan/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType, mode: "ai_scan" }),
      });

      const data = await res.json();

      if (res.status === 429) {
        toast.error(
          "Monthly scan limit reached. Upgrade for unlimited scans.",
          { duration: 5000 }
        );
        router.push("/billing");
        return;
      }

      // Store extraction in session storage to prevent re-calling API on back navigation [I-4]
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      sessionStorage.setItem("last_extraction_key", cacheKey);
      sessionStorage.setItem("last_extraction_ts", Date.now().toString());

      router.push("/scan/review");
    } catch {
      // Route to review with empty extraction — never crash [I-4]
      const fallback = {
        success: false,
        extraction: {
          supplier_name: null,
          invoice_date: null,
          invoice_number: null,
          total_amount: null,
          confidence: 0,
          items: [],
          extraction_notes: "Couldn't read the bill. Enter items manually below.",
          source: "ai_scan",
        },
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(fallback));
      sessionStorage.setItem("last_extraction_key", cacheKey);
      sessionStorage.setItem("last_extraction_ts", Date.now().toString());
      router.push("/scan/review");
    }
  }

  if (mode === "processing") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="text-gray-600 font-medium">{processingMsg}</p>
        <p className="text-xs text-gray-400">Usually takes 3–8 seconds</p>
      </div>
    );
  }

  if (mode === "scan") {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setMode("choose")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold">Scan bill</h1>
        </div>
        <CameraCapture onCapture={handleCapture} />
      </div>
    );
  }

  // Mode: choose
  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-2">Add stock</h1>
      <p className="text-gray-500 text-sm mb-6">
        How do you want to add items?
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setMode("scan")}
          className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
        >
          <Camera className="h-8 w-8 text-blue-500" />
          <div>
            <p className="font-semibold text-sm">Scan bill</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Point camera at invoice
            </p>
          </div>
        </button>

        <Link
          href="/scan/manual"
          className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <PenLine className="h-8 w-8 text-gray-400" />
          <div>
            <p className="font-semibold text-sm">Type it in</p>
            <p className="text-xs text-gray-400 mt-0.5">Enter items yourself</p>
          </div>
        </Link>
      </div>

      <p className="text-xs text-center text-gray-400 mb-6">
        Manual entry doesn&apos;t use your monthly scan allowance
      </p>

      <div className="border-t border-gray-100 pt-4">
        <Link
          href="/scan/history"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <Clock className="h-4 w-4" />
          Use a past order as a template
        </Link>
      </div>
    </div>
  );
}
