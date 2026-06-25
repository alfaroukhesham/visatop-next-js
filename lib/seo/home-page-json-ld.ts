import { appHref } from "@/lib/app-href";
import { getSiteSchemaIds } from "@/lib/seo/site-schema-ids";

const HOME_DESCRIPTION =
  "Start your UAE visa from your nationality—upload documents, pay securely, and track your application in one place.";

/**
 * Page-level JSON-LD for /visa-processing/.
 * Organization + WebSite are owned by Yoast on visatop.com — reference by @id only.
 */
export function buildHomePageJsonLd() {
  const { organizationId, websiteId } = getSiteSchemaIds();
  const homeUrl = appHref("/");
  const webPageId = `${homeUrl}#webpage`;
  const serviceId = `${homeUrl}#service`;

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
        inLanguage: "en-GB",
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
      },
    ],
  };
}
