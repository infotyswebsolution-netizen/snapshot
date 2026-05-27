import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQuantity, formatCurrency } from "@/lib/utils/format";
import { Package, AlertTriangle, Camera } from "lucide-react";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
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

  const { q } = await searchParams;

  let query = supabase
    .from("items")
    .select("id, name, current_quantity, low_stock_threshold, unit, last_unit_price, category")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name");

  if (q) {
    query = query.textSearch("name_tsv", q, { type: "websearch" });
  }

  const { data: items } = await query;

  return (
    <div>
      <PageHeader
        title="Inventory"
        action={
          <Link href="/scan" className={buttonVariants()}>
            <Camera className="h-4 w-4 mr-2" />
            Scan bill
          </Link>
        }
      />

      <form className="mb-4">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search items..."
          className="h-11 text-base"
        />
      </form>

      {!items?.length ? (
        <div className="text-center py-16">
          <Package className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No items yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Scan your first delivery bill to start tracking stock.
          </p>
          <Link href="/scan" className={buttonVariants()}>Scan a bill</Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {items.map((item) => {
            const isLow =
              item.low_stock_threshold !== null &&
              item.current_quantity <= item.low_stock_threshold;
            return (
              <Link
                key={item.id}
                href={`/inventory/${item.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.name}
                    </p>
                    {isLow && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  {item.category && (
                    <p className="text-xs text-gray-400">{item.category}</p>
                  )}
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <Badge
                    variant={isLow ? "outline" : "secondary"}
                    className={
                      isLow
                        ? "text-amber-700 border-amber-200 bg-amber-50"
                        : "text-gray-600"
                    }
                  >
                    {formatQuantity(item.current_quantity, item.unit)}
                  </Badge>
                  {item.last_unit_price && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCurrency(item.last_unit_price, business.currency)} / unit
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
