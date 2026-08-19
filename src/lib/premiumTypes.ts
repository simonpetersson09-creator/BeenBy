/** Client-safe shape of the server's Premium verdict. */
export type EntitlementState = {
  isPremium: boolean;
  productId?: string;
  expiresAt?: string;
  environment?: string;
  error?: string;
};
