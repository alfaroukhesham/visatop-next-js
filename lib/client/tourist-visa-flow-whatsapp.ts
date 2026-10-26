/**
 * Path matcher for the floating WhatsApp A/B test on the tourist visa flow.
 * `usePathname()` is basePath-stripped; tests may pass `/visa-processing/...`.
 */
export const TOURIST_VISA_FLOW_WHATSAPP_STEPS = [
  "nationality",
  "visa",
  "documents",
  "checkout",
  "checkoutReturn",
  "submitted",
  "resume",
  "linkAfterSignup",
] as const;

export type TTouristVisaFlowWhatsAppStep = (typeof TOURIST_VISA_FLOW_WHATSAPP_STEPS)[number];

const APP_BASE_PATH = "/visa-processing";

export const normalizeClientPathname = (pathname: string): string => {
  const raw = (pathname.trim().split(/[?#]/, 1)[0] ?? "").trim();
  const withoutBase =
    raw === APP_BASE_PATH || raw.startsWith(`${APP_BASE_PATH}/`)
      ? raw.slice(APP_BASE_PATH.length) || "/"
      : raw;
  const withLeading = withoutBase.startsWith("/") ? withoutBase : `/${withoutBase}`;
  if (withLeading === "/") return "/";
  return withLeading.replace(/\/+$/, "") || "/";
};

export const matchTouristVisaFlowWhatsAppStep = (
  pathname: string,
): TTouristVisaFlowWhatsAppStep | null => {
  const path = normalizeClientPathname(pathname);

  if (path === "/" || path === "/apply") return "nationality";
  if (path === "/apply/start" || path.startsWith("/apply/start/")) return "visa";
  if (path === "/apply/resume" || path.startsWith("/apply/resume/")) return "resume";
  if (path === "/apply/link-after-signup" || path.startsWith("/apply/link-after-signup/")) {
    return "linkAfterSignup";
  }
  if (path === "/apply/track" || path.startsWith("/apply/track/")) return null;

  const applicationMatch = path.match(/^\/apply\/applications\/[^/]+(?:\/(.*))?$/);
  if (!applicationMatch) return null;

  const rest = applicationMatch[1] ?? "";
  if (rest === "payment" || rest.startsWith("payment/")) return "checkout";
  if (rest === "checkout" || rest.startsWith("checkout/")) return "checkoutReturn";
  if (rest === "submitted" || rest.startsWith("submitted/")) return "submitted";
  return "documents";
};
