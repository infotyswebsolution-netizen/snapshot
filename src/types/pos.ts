export type PosType = "square" | "clover" | "lightspeed";

export interface PosTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  merchantId: string;
  locationId?: string;
  scopes?: string[];
}

export interface PosInventoryItem {
  externalId: string;
  name: string;
  quantity: number;
  locationId?: string;
}

export interface SquareOAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  merchant_id: string;
  token_type: string;
}

export interface CloverOAuthResponse {
  access_token: string;
  merchant_id: string;
  token_type: string;
}
