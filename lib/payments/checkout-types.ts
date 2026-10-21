export type CheckoutSessionData =
  | { provider: "paddle"; transactionId: string; clientToken: string }
  | { provider: "ziina"; embeddedUrl: string }
  | { provider: "fincra"; redirectUrl: string };

export type TZiinaCheckoutSession =
  | { kind: "open"; embeddedUrl: string }
  | { kind: "none" }
  | { kind: "paid" }
  | { kind: "confirming" }
  | { kind: "closed"; status: string }
  | { kind: "unavailable" }
  | { kind: "not_ziina" };

export type TResumeCheckoutSession =
  | TZiinaCheckoutSession
  | { kind: "fincra_redirect"; redirectUrl: string };
