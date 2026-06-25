import { appHref } from "@/lib/app-href";
import { getAppOrigin } from "@/lib/app-url";

const HOME_DESCRIPTION =
  "Start your UAE visa from your nationality—upload documents, pay securely, and track your application in one place.";

export function buildHomePageJsonLd() {
  const origin = getAppOrigin();
  const homeUrl = appHref("/");
  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;
  const webPageId = `${homeUrl}#webpage`;
  const serviceId = `${homeUrl}#service`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Visatop",
        url: origin,
        email: "info@visatop.com",
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: origin,
        name: "Visatop",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebPage",
        "@id": webPageId,
        url: homeUrl,
        name: "Apply for UAE Tourist Visa Online",
        description: HOME_DESCRIPTION,
        isPartOf: { "@id": websiteId },
        about: { "@id": serviceId },
        inLanguage: "en",
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
