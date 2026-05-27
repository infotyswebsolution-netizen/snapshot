import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: business } = await supabase
      .from("businesses")
      .select("onboarding_completed_at")
      .eq("owner_id", user.id)
      .single();

    if (!business?.onboarding_completed_at) {
      redirect("/onboarding");
    }
    redirect("/dashboard");
  }

  redirect("/login");
}
