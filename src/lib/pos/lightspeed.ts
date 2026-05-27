export function getLightspeedOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LIGHTSPEED_CLIENT_ID!,
    scope: "employee:inventory",
    state,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/pos/callback?pos=lightspeed`,
  });
  return `https://cloud.lightspeedapp.com/oauth/authorize.php?${params}`;
}

export async function exchangeLightspeedCode(code: string) {
  const resp = await fetch(
    "https://cloud.lightspeedapp.com/oauth/access_token.php",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.LIGHTSPEED_CLIENT_ID!,
        client_secret: process.env.LIGHTSPEED_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/pos/callback?pos=lightspeed`,
      }),
    }
  );
  if (!resp.ok) throw new Error(`Lightspeed token exchange failed: ${resp.status}`);
  return resp.json();
}
