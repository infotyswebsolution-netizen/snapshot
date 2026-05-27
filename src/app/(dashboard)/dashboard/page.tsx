import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/utils/format";
import { AlertTriangle, Camera, Package, Truck } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, currency")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/login");

  const [lowStockRes, recentScansRes, totalItemsRes] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, current_quantity, low_stock_threshold, unit")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .not("low_stock_threshold", "is", null)
      .filter("current_quantity", "lte", "low_stock_threshold")
      .order("current_quantity", { ascending: true })
      .limit(5),
    supabase
      .from("scans")
      .select("id, scan_date, item_count, total_amount, entry_source, suppliers(name)")
      .eq("business_id", business.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("is_active", true),
  ]);

  const lowStockItems = lowStockRes.data ?? [];
  const recentScans = recentScansRes.data ?? [];
  const totalItems = totalItemsRes.count ?? 0;

  return (
    <div>
      <PageHeader
        title={`Good to see you`}
        action={
          <Link href="/scan" className={buttonVariants()}>
            <Camera className="h-4 w-4 mr-2" />
            Scan bill
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-500 font-medium">Items tracked</span>
            </div>
            <p className="text-2xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-gray-500 font-medium">Running low</span>
            </div>
            <p className="text-2xl font-bold">{lowStockItems.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Running low — time to reorder
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/inventory/${item.id}`}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {item.name}
                  </span>
                  <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                    {formatQuantity(item.current_quantity, item.unit)} left
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent scans */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-400" />
            Recent deliveries
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {recentScans.length === 0 ? (
            <div className="text-center py-8">
              <Camera className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                No deliveries yet. Scan your first bill to get started.
              </p>
              <Link href="/scan" className={buttonVariants({ size: "sm" }) + " mt-4"}>
                Scan a bill
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentScans.map((scan) => {
                const supplier = (scan.suppliers as unknown) as { name: string } | null;
                return (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {supplier?.name ?? "Unknown supplier"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(scan.scan_date)} · {scan.item_count} items ·{" "}
                        {scan.entry_source === "manual" ? "Manual" : "Scanned"}
                      </p>
                    </div>
                    {scan.total_amount && (
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(scan.total_amount, business.currency)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
