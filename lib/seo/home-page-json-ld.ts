import { appHref } from "@/lib/app-href";
import { getAppOrigin } from "@/lib/app-url";
import { getSiteSchemaIds } from "@/lib/seo/site-schema-ids";

const HOME_DESCRIPTION =
  "Start your UAE visa from your nationality—upload documents, pay securely, and track your application in one place.";

/**
 * Page-level JSON-LD for /visa-processing.
 * Organization + WebSite are owned by Yoast on visatop.com — reference by @id only.
 */
export function buildHomePageJsonLd() {
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
        name: "Apply for UAE Tourist Visa Online",
        description: HOME_DESCRIPTION,
        isPartOf: { "@id": websiteId },
        about: { "@id": serviceId },
        breadcrumb: { "@id": breadcrumbId },
        inLanguage: "en-GB",
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
            name: "VisaTop",
            item: `${origin}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Apply for UAE Tourist Visa Online",
            item: homeUrl,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": serviceId,
        name: "UAE Tourist Visa Application",
        description:
          "Online UAE tourist visa processing for travelers to Dubai and the UAE. Select your nationality, upload documents, pay securely, and track your application.",
        provider: { "@id": organizationId },
        areaServed: {
          "@type": "Country",
          name: "United Arab Emirates",
        },
        serviceType: "Visa processing",
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
            description:
              "All-inclusive fee varies by passport nationality and visa type (14-, 30-, or 60-day); exact price confirmed at checkout in USD or AED.",
          },
        },
      },
    ],
  };
}
