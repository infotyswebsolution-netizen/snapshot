import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Truck } from "lucide-react";

export default async function SuppliersPage() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) redirect("/login");

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, phone, email, is_active")
    .eq("business_id", business.id)
    .order("name");

  return (
    <div>
      <PageHeader title="Suppliers" />

      {!suppliers?.length ? (
        <div className="text-center py-16">
          <Truck className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No suppliers yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Suppliers are created when you scan a bill.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <Link key={s.id} href={`/suppliers/${s.id}`}>
              <Card className="hover:border-blue-200 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      {s.phone && (
                        <p className="text-xs text-gray-400 mt-0.5">{s.phone}</p>
                      )}
                    </div>
                    <Truck className="h-4 w-4 text-gray-300" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
