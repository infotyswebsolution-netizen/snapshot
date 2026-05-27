import type { CloverOAuthResponse } from "@/types/pos";

const CLOVER_BASE = "https://www.clover.com";
const CLOVER_API = "https://api.clover.com";

export function getCloverOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.CLOVER_APP_ID!,
    response_type: "code",
    state,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/pos/callback?pos=clover`,
  });
  return `${CLOVER_BASE}/oauth/v2/authorize?${params}`;
}

export async function exchangeCloverCode(
  code: string,
  merchantId: string
): Promise<CloverOAuthResponse> {
  const resp = await fetch(`${CLOVER_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.CLOVER_APP_ID,
      client_secret: process.env.CLOVER_APP_SECRET,
      code,
      merchant_id: merchantId,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Clover token exchange failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

export async function getCloverInventory(
  accessToken: string,
  merchantId: string
) {
  const resp = await fetch(
    `${CLOVER_API}/v3/merchants/${merchantId}/items?expand=inventoryItems`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!resp.ok) throw new Error(`Clover inventory fetch failed: ${resp.status}`);
  return resp.json();
}
