import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

/** Crawler-facing service facts (hidden in UI; referenced by JSON-LD speakable). */
export const getHomeServiceFacts = (locale = "en"): string[] => {
  const t = createCustomerT(locale);
  return [
    t("seo.serviceFacts.processingTime"),
    t("seo.serviceFacts.pricing"),
    t("seo.serviceFacts.visaTypes"),
    t("seo.serviceFacts.portal"),
  ];
};

export const HOME_SERVICE_FACTS = getHomeServiceFacts("en");
