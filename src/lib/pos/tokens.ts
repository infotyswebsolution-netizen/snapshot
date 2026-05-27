import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PosType } from "@/types/pos";

async function callVaultRpc(
  supabase: SupabaseClient<Database>,
  fn: "vault_encrypt_token" | "vault_decrypt_token",
  arg: string
): Promise<string> {
  const paramKey = fn === "vault_encrypt_token" ? "plaintext_token" : "encrypted_token";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn as any, { [paramKey]: arg });
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as string;
}

export async function encryptToken(
  supabase: SupabaseClient<Database>,
  plaintext: string
): Promise<string> {
  return callVaultRpc(supabase, "vault_encrypt_token", plaintext);
}

export async function decryptToken(
  supabase: SupabaseClient<Database>,
  ciphertext: string
): Promise<string> {
  return callVaultRpc(supabase, "vault_decrypt_token", ciphertext);
}

async function refreshPosToken(
  posType: PosType,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: string }> {
  switch (posType) {
    case "square": {
      const resp = await fetch("https://connect.squareup.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.SQUARE_APP_ID,
          client_secret: process.env.SQUARE_APP_SECRET,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });
      if (!resp.ok) throw new Error(`Square refresh failed: ${resp.status}`);
      const data = await resp.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      };
    }
    default:
      throw new Error(`Refresh not implemented for ${posType}`);
  }
}

export async function getValidAccessToken(
  supabase: SupabaseClient<Database>,
  businessId: string,
  posType: PosType
): Promise<string | null> {
  const { data: conn } = await supabase
    .from("pos_connections")
    .select("access_token_enc, refresh_token_enc, token_expires_at")
    .eq("business_id", businessId)
    .eq("pos_type", posType)
    .eq("is_active", true)
    .single();

  if (!conn) return null;

  const expiresAt = new Date(conn.token_expires_at ?? 0);
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > fiveMinutesFromNow) {
    return decryptToken(supabase, conn.access_token_enc);
  }

  if (!conn.refresh_token_enc) return null;

  try {
    const currentRefresh = await decryptToken(supabase, conn.refresh_token_enc);
    const newTokens = await refreshPosToken(posType, currentRefresh);

    await supabase
      .from("pos_connections")
      .update({
        access_token_enc: await encryptToken(supabase, newTokens.accessToken),
        refresh_token_enc: newTokens.refreshToken
          ? await encryptToken(supabase, newTokens.refreshToken)
          : conn.refresh_token_enc,
        token_expires_at: newTokens.expiresAt,
        last_error_message: null,
      })
      .eq("business_id", businessId)
      .eq("pos_type", posType);

    return newTokens.accessToken;
  } catch {
    await supabase
      .from("pos_connections")
      .update({
        is_active: false,
        last_sync_status: "failed",
        last_error_message: "Token refresh failed. Please reconnect.",
      })
      .eq("business_id", businessId)
      .eq("pos_type", posType);
    return null;
  }
}
