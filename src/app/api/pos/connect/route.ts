import { createServerClient } from "@/lib/supabase/server";
import { getSquareOAuthUrl } from "@/lib/pos/square";
import { getCloverOAuthUrl } from "@/lib/pos/clover";
import { getLightspeedOAuthUrl } from "@/lib/pos/lightspeed";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const pos = req.nextUrl.searchParams.get("pos") as "square" | "clover" | "lightspeed";
  if (!pos) {
    return NextResponse.json({ error: "pos parameter required" }, { status: 400 });
  }

  // State token for CSRF protection — includes user ID
  const state = crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(user.id + "|" + pos + "|" + Date.now())
    .digest("hex");

  // Store state in cookie for verification at callback
  const response = NextResponse.redirect(
    pos === "square"
      ? getSquareOAuthUrl(state)
      : pos === "clover"
      ? getCloverOAuthUrl(state)
      : getLightspeedOAuthUrl(state)
  );
  response.cookies.set("pos_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  return response;
}
