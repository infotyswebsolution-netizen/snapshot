import { createServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatCurrency } from "@/lib/utils/format";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
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

  const { supplierId } = await params;

  const [supplierRes, scansRes] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, phone, email, address, notes")
      .eq("id", supplierId)
      .eq("business_id", business.id)
      .single(),
    supabase
      .from("scans")
      .select("id, scan_date, item_count, total_amount, status")
      .eq("supplier_id", supplierId)
      .eq("business_id", business.id)
      .order("scan_date", { ascending: false })
      .limit(20),
  ]);

  if (!supplierRes.data) notFound();
  const supplier = supplierRes.data;
  const scans = scansRes.data ?? [];

  const totalSpend = scans.reduce((s, sc) => s + (sc.total_amount ?? 0), 0);

  return (
    <div>
      <PageHeader title={supplier.name} />

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Total orders</p>
            <p className="text-2xl font-bold">{scans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Total spend</p>
            <p className="text-2xl font-bold">
              {formatCurrency(totalSpend, business.currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 space-y-2">
          {supplier.phone && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Phone</span>
              <a href={`tel:${supplier.phone}`} className="text-blue-600">
                {supplier.phone}
              </a>
            </div>
          )}
          {supplier.email && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <a href={`mailto:${supplier.email}`} className="text-blue-600">
                {supplier.email}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Order history</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {scans.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No orders yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {scans.map((scan) => (
                <div key={scan.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{formatDate(scan.scan_date)}</p>
                    <p className="text-xs text-gray-400">{scan.item_count} items</p>
                  </div>
                  {scan.total_amount && (
                    <span className="text-sm text-gray-700">
                      {formatCurrency(scan.total_amount, business.currency)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
