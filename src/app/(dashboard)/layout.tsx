import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { PlanBanner } from "@/components/layout/PlanBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Independent auth check [I-8] — middleware alone is not sufficient
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, plan, scans_used_this_month, scan_limit, onboarding_completed_at")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    redirect("/login");
  }

  if (!business.onboarding_completed_at) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* Sidebar with plan banner at bottom — desktop only */}
      <div className="hidden lg:flex flex-col w-60 fixed inset-y-0 z-40">
        <Sidebar businessName={business.name} />
        <div className="absolute bottom-16 left-0 right-0">
          <PlanBanner
            plan={business.plan as "starter" | "growth" | "pro"}
            scansUsed={business.scans_used_this_month}
            scanLimit={business.scan_limit}
          />
        </div>
      </div>

      {/* Mobile header + bottom nav */}
      <MobileNav businessName={business.name} />

      {/* Main content */}
      <main className="flex-1 lg:pl-60">
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24 lg:pb-6">
          {children}
        </div>
      </main>
    </div>
  );
}
