/** UAE support line; digits only for wa.me. */
const SUPPORT_PHONE_E164_DIGITS = "971503156105";

export const SUPPORT_PHONE_DISPLAY = "+971 50 3156 105";

export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_E164_DIGITS}`;

/** Default prefill for Google Ads landing page WhatsApp CTA. */
export const WHATSAPP_LP_PREFILL_MESSAGE =
  "Hi, I'm interested in a UAE visa and would like to speak with an expert.";

export const buildWhatsAppUrl = (text?: string): string => {
  const base = `https://wa.me/${SUPPORT_PHONE_E164_DIGITS}`;
  if (!text?.trim()) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
};

export const SUPPORT_WHATSAPP_LP_URL = buildWhatsAppUrl(WHATSAPP_LP_PREFILL_MESSAGE);
