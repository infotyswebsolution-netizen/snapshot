import { createServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatQuantity, formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils/format";
import { AlertTriangle, Clock } from "lucide-react";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, currency")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/login");

  const { itemId } = await params;

  const [itemRes, auditRes] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, current_quantity, unit, low_stock_threshold, category, last_unit_price, avg_unit_price, preferred_supplier_id, suppliers(name), created_at, updated_at")
      .eq("id", itemId)
      .eq("business_id", business.id)
      .single(),
    supabase
      .from("inventory_audit_log")
      .select("id, change_type, quantity_before, quantity_change, quantity_after, source_ref, source_pos, notes, created_at")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!itemRes.data) notFound();
  const item = itemRes.data;
  const auditLog = auditRes.data ?? [];

  const isLow =
    item.low_stock_threshold !== null &&
    item.current_quantity <= item.low_stock_threshold;

  const supplier = (item.suppliers as unknown) as { name: string } | null;

  const changeTypeLabel: Record<string, string> = {
    scan_add: "Added from bill scan",
    manual_add: "Added manually",
    manual_edit: "Manually edited",
    manual_delete: "Removed",
    pos_sale_deduct: "Sold at register",
    pos_sync_adjust: "Register sync",
    pos_catalog_create: "Register catalog import",
    system_reset: "System adjustment",
  };

  return (
    <div>
      <PageHeader title={item.name} />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">In stock</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">
                {formatQuantity(item.current_quantity, item.unit)}
              </p>
              {isLow && (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
            </div>
            {isLow && (
              <p className="text-xs text-amber-600 mt-1">Running low</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Last price</p>
            <p className="text-2xl font-bold">
              {item.last_unit_price
                ? formatCurrency(item.last_unit_price, business.currency)
                : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">per unit</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 space-y-2">
          {item.category && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Category</span>
              <span>{item.category}</span>
            </div>
          )}
          {supplier && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Supplier</span>
              <span>{supplier.name}</span>
            </div>
          )}
          {item.low_stock_threshold !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Alert when below</span>
              <Badge variant="outline">
                {formatQuantity(item.low_stock_threshold, item.unit)}
              </Badge>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Last updated</span>
            <span className="text-gray-700">{formatRelativeTime(item.updated_at)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {auditLog.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No history yet.</p>
          ) : (
            <div className="space-y-0 divide-y divide-gray-50">
              {auditLog.map((entry) => (
                <div key={entry.id} className="py-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {changeTypeLabel[entry.change_type] ?? entry.change_type}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatRelativeTime(entry.created_at)}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <span
                      className={`text-sm font-medium ${
                        entry.quantity_change > 0
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {entry.quantity_change > 0 ? "+" : ""}
                      {entry.quantity_change}
                    </span>
                    <p className="text-xs text-gray-400">
                      → {formatQuantity(entry.quantity_after, item.unit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
