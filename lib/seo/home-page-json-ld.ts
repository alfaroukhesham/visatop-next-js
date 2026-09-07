import { createCustomerT, customerInLanguageTag } from "@/lib/i18n/load-customer-catalog";
import { parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { appHref } from "@/lib/app-href";
import { getAppOrigin } from "@/lib/app-url";
import { getSiteSchemaIds } from "@/lib/seo/site-schema-ids";

interface IBuildHomePageJsonLdOptions {
  locale?: string;
}

/**
 * Page-level JSON-LD for /visa-processing.
 * Organization + WebSite are owned by Yoast on visatop.com — reference by @id only.
 */
export const buildHomePageJsonLd = (opts?: IBuildHomePageJsonLdOptions) => {
  const locale = parseCustomerLocale(opts?.locale);
  const t = createCustomerT(locale);
  const { organizationId, websiteId } = getSiteSchemaIds();
  const origin = getAppOrigin();
  const homeUrl = appHref("/");
  const webPageId = `${homeUrl}#webpage`;
  const serviceId = `${homeUrl}#service`;
  const breadcrumbId = `${homeUrl}#breadcrumb`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": webPageId,
        url: homeUrl,
        name: t("seo.jsonLd.webPageName"),
        description: t("seo.jsonLd.webPageDescription"),
        isPartOf: { "@id": websiteId },
        about: { "@id": serviceId },
        breadcrumb: { "@id": breadcrumbId },
        inLanguage: customerInLanguageTag(locale),
        speakable: {
          "@type": "SpeakableSpecification",
          cssSelector: ["#service-facts"],
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: t("seo.jsonLd.breadcrumbBrand"),
            item: `${origin}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: t("seo.jsonLd.breadcrumbApply"),
            item: homeUrl,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": serviceId,
        name: t("seo.jsonLd.serviceName"),
        description: t("seo.jsonLd.serviceDescription"),
        provider: { "@id": organizationId },
        areaServed: {
          "@type": "Country",
          name: t("seo.jsonLd.areaServed"),
        },
        serviceType: t("seo.jsonLd.serviceType"),
        url: homeUrl,
        offers: {
          "@type": "Offer",
          url: homeUrl,
          availability: "https://schema.org/InStock",
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "PriceSpecification",
            priceCurrency: "USD",
            valueAddedTaxIncluded: true,
            description: t("seo.jsonLd.priceDescription"),
          },
        },
      },
    ],
  };
};
