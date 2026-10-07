/** Public Terms of Use URL (WordPress). Do not persist acceptance — gate only. */
export const TERMS_OF_USE_URL = "https://visatop.com/term-of-use/" as const;

export const isCheckoutTermsAccepted = (body: unknown): boolean => {
  if (typeof body !== "object" || body === null) return false;
  return (body as { termsAccepted?: unknown }).termsAccepted === true;
};
