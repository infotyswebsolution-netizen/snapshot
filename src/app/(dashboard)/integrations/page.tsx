import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils/format";
import { CheckCircle2, XCircle, Plug } from "lucide-react";

const POS_PROVIDERS = [
  {
    id: "square",
    name: "Square",
    description: "Auto-update inventory when you make a sale",
    plan: "growth",
  },
  {
    id: "clover",
    name: "Clover",
    description: "Auto-update inventory when you make a sale",
    plan: "growth",
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    description: "Auto-update inventory when you make a sale",
    plan: "pro",
  },
];

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const [bizRes, connectionsRes] = await Promise.all([
    supabase.from("businesses").select("id, plan").eq("owner_id", user.id).single(),
    supabase.from("pos_connections").select("pos_type, is_active, last_sync_at, last_sync_status, last_error_message").eq("is_active", true),
  ]);

  if (!bizRes.data) redirect("/login");
  const business = bizRes.data;
  const connections = connectionsRes.data ?? [];

  const params = await searchParams;

  return (
    <div>
      <PageHeader
        title="Connect register"
        description="Link your point-of-sale so inventory stays accurate automatically"
      />

      {params.connected && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 mb-4 text-sm text-green-700">
          {params.connected} connected! Syncing your items now...
        </div>
      )}
      {params.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 mb-4 text-sm text-red-700">
          Connection failed. Please try again.
        </div>
      )}

      <div className="space-y-3">
        {POS_PROVIDERS.map((provider) => {
          const conn = connections.find((c) => c.pos_type === provider.id);
          const planOk =
            business.plan === "pro" ||
            (business.plan === "growth" && provider.plan === "growth");

          return (
            <Card key={provider.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{provider.name}</p>
                      {conn ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-400">
                          Not connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{provider.description}</p>
                    {conn?.last_sync_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Last sync: {formatRelativeTime(conn.last_sync_at)}
                      </p>
                    )}
                    {conn?.last_error_message && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-500">
                        <XCircle className="h-3 w-3" />
                        {conn.last_error_message}
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    {!planOk ? (
                      <Link href="/billing" className={buttonVariants({ size: "sm", variant: "outline" })}>
                        Upgrade to {provider.plan === "pro" ? "Pro" : "Growth"}
                      </Link>
                    ) : conn ? (
                      <DisconnectButton pos={provider.id} />
                    ) : (
                      <Link href={`/api/pos/connect?pos=${provider.id}`} className={buttonVariants({ size: "sm" })}>
                        <Plug className="h-3.5 w-3.5 mr-1.5" />
                        Connect
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DisconnectButton({ pos }: { pos: string }) {
  "use client";
  return (
    <form
      action={async () => {
        "use server";
        // Handled by client-side disconnect
      }}
    >
      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
        Disconnect
      </Button>
    </form>
  );
}
