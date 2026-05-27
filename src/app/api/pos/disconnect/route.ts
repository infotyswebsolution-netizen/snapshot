import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pos } = await req.json() as { pos: "square" | "clover" | "lightspeed" | "toast" };
  if (!pos) {
    return NextResponse.json({ error: "pos required" }, { status: 400 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await supabase
    .from("pos_connections")
    .update({ is_active: false, last_sync_status: "failed" })
    .eq("business_id", business.id)
    .eq("pos_type", pos);

  return NextResponse.json({ success: true });
}
