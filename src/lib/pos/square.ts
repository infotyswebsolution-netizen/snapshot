import type { SquareOAuthResponse } from "@/types/pos";

const SQUARE_BASE = "https://connect.squareup.com";
const SQUARE_SANDBOX = "https://connect.squareupsandbox.com";

function squareBase() {
  return process.env.NODE_ENV === "production" ? SQUARE_BASE : SQUARE_SANDBOX;
}

export function getSquareOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SQUARE_APP_ID!,
    response_type: "code",
    scope: "INVENTORY_READ INVENTORY_WRITE ITEMS_READ MERCHANT_PROFILE_READ",
    state,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/pos/callback?pos=square`,
  });
  return `${squareBase()}/oauth2/authorize?${params}`;
}

export async function exchangeSquareCode(
  code: string
): Promise<SquareOAuthResponse> {
  const resp = await fetch(`${squareBase()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APP_ID,
      client_secret: process.env.SQUARE_APP_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/pos/callback?pos=square`,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Square token exchange failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

export async function revokeSquareToken(accessToken: string): Promise<void> {
  await fetch(`${squareBase()}/oauth2/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Client ${process.env.SQUARE_APP_SECRET}`,
    },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APP_ID,
      access_token: accessToken,
    }),
  });
}

export async function getSquareCatalog(accessToken: string) {
  const resp = await fetch(`${squareBase()}/v2/catalog/list?types=ITEM`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) throw new Error(`Square catalog fetch failed: ${resp.status}`);
  return resp.json();
}
