export type CheckoutSessionData =
  | { provider: "paddle"; transactionId: string; clientToken: string }
  | { provider: "ziina"; redirectUrl: string };
