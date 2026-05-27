import { createServerClient } from "@/lib/supabase/server";
import { exchangeSquareCode } from "@/lib/pos/square";
import { exchangeCloverCode } from "@/lib/pos/clover";
import { exchangeLightspeedCode } from "@/lib/pos/lightspeed";
import { encryptToken } from "@/lib/pos/tokens";
import { inngest } from "@/lib/inngest/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = req.nextUrl;
  const pos = searchParams.get("pos") as "square" | "clover" | "lightspeed";
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("pos_oauth_state")?.value;

  // CSRF state check
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      new URL("/integrations?error=invalid_state", req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/integrations?error=no_code", req.url)
    );
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!business) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    let accessToken: string;
    let refreshToken: string | undefined;
    let expiresAt: string;
    let merchantId: string;

    if (pos === "square") {
      const tokens = await exchangeSquareCode(code);
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token;
      expiresAt = tokens.expires_at;
      merchantId = tokens.merchant_id;
    } else if (pos === "clover") {
      const merchantIdParam = searchParams.get("merchant_id") ?? "";
      const tokens = await exchangeCloverCode(code, merchantIdParam);
      accessToken = tokens.access_token;
      merchantId = tokens.merchant_id;
      // Clover tokens don't expire — use far future date
      expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    } else {
      const tokens = await exchangeLightspeedCode(code);
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token;
      expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      merchantId = tokens.account_id?.toString() ?? "unknown";
    }

    // Encrypt tokens before storage [I-6]
    const accessTokenEnc = await encryptToken(supabase, accessToken);
    const refreshTokenEnc = refreshToken
      ? await encryptToken(supabase, refreshToken)
      : null;

    await supabase.from("pos_connections").upsert(
      {
        business_id: business.id,
        pos_type: pos,
        merchant_id: merchantId,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_expires_at: expiresAt,
        is_active: true,
        last_sync_status: "never",
      },
      { onConflict: "business_id,pos_type" }
    );

    // Kick off initial catalog sync
    await inngest.send({
      name: "pos/square-catalog-sync",
      data: { businessId: business.id },
    });

    const response = NextResponse.redirect(
      new URL("/integrations?connected=" + pos, req.url)
    );
    response.cookies.delete("pos_oauth_state");
    return response;
  } catch (err) {
    console.error("[pos/callback] token exchange failed:", err);
    return NextResponse.redirect(
      new URL("/integrations?error=connection_failed", req.url)
    );
  }
}
