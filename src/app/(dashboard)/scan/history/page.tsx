import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import { Camera, PenLine, Clock } from "lucide-react";

export default async function ScanHistoryPage() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, currency")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/login");

  const { data: scans } = await supabase
    .from("scans")
    .select("id, scan_date, item_count, total_amount, entry_source, suppliers(name)")
    .eq("business_id", business.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Past deliveries"
        description="Tap 'Use as template' to reorder with the same items"
      />

      {!scans?.length ? (
        <div className="text-center py-16 text-gray-400">
          <Clock className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No deliveries recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((scan) => {
            const supplier = (scan.suppliers as unknown) as { name: string } | null;
            return (
              <Card key={scan.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold">
                        {supplier?.name ?? "No supplier"}
                      </p>
                      {scan.entry_source === "ai_scan" ? (
                        <Camera className="h-3.5 w-3.5 text-blue-400" />
                      ) : (
                        <PenLine className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {formatDate(scan.scan_date)} · {scan.item_count} items
                      {scan.total_amount
                        ? ` · ${formatCurrency(scan.total_amount, business.currency)}`
                        : ""}
                    </p>
                  </div>
                  <Link
                    href={`/scan/manual?template=${scan.id}`}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                  >
                    Use as template →
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
