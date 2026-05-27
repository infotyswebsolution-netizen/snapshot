import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import type { Plan } from "@/types/app";

interface PlanBannerProps {
  plan: Plan;
  scansUsed: number;
  scanLimit: number;
}

export function PlanBanner({ plan, scansUsed, scanLimit }: PlanBannerProps) {
  if (scanLimit >= 999999) return null; // Unlimited — no banner needed

  const pct = Math.min((scansUsed / scanLimit) * 100, 100);
  const nearLimit = pct >= 80;
  const atLimit = pct >= 100;

  return (
    <div
      className={`mx-3 mb-3 rounded-xl p-3 text-xs ${
        atLimit
          ? "bg-red-50 border border-red-100"
          : nearLimit
          ? "bg-amber-50 border border-amber-100"
          : "bg-gray-50 border border-gray-100"
      }`}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span
          className={`font-medium ${
            atLimit
              ? "text-red-700"
              : nearLimit
              ? "text-amber-700"
              : "text-gray-600"
          }`}
        >
          {atLimit ? "Scan limit reached" : `${scansUsed} of ${scanLimit} scans used`}
        </span>
        <span className="text-gray-400 capitalize">{plan}</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      {nearLimit && (
        <Link
          href="/billing"
          className="block mt-2 text-blue-600 font-medium hover:underline"
        >
          Upgrade for unlimited scans →
        </Link>
      )}
    </div>
  );
}
