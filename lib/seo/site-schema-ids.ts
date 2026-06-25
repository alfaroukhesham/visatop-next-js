import { getAppOrigin } from "@/lib/app-url";

/**
 * Canonical schema.org entity IDs for visatop.com.
 * Must stay aligned with Yoast SEO output on the WordPress site.
 */
export function getSiteSchemaIds() {
  const origin = getAppOrigin();

  return {
    origin,
    /** Yoast Organization node — do not re-define on Next.js pages. */
    organizationId: `${origin}/#organization`,
    /** Yoast WebSite node — do not re-define on Next.js pages. */
    websiteId: `${origin}/#website`,
    /** Brand spelling used across WP Yoast and theme schema. */
    brandName: "VisaTop",
  } as const;
}
