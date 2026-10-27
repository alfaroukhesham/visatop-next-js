import Script from "next/script";
import { buildGoogleTagBootstrapScript } from "@/lib/analytics/gtag-bootstrap";
import {
  getGadsConversionId,
  getGaMeasurementId,
  getGoogleTagId,
} from "@/lib/analytics/gtag-ids";

type GoogleTagProps = {
  googleTagId?: string;
  gaMeasurementId?: string;
  gadsConversionId?: string;
};

/**
 * Loads Google tag (gtag.js) on the Next.js root document — not via WP iframes.
 * Uses Google Tag ID (GT-…) as the primary script id, matching Site Kit.
 * The remote gtag.js is `lazyOnload` so it does not compete with LCP; the inline
 * bootstrap stays `afterInteractive` so events can still queue.
 */
export function GoogleTag({
  googleTagId = getGoogleTagId(),
  gaMeasurementId = getGaMeasurementId(),
  gadsConversionId = getGadsConversionId(),
}: GoogleTagProps = {}) {
  const bootstrap = buildGoogleTagBootstrapScript({
    googleTagId,
    gaMeasurementId,
    gadsConversionId,
  });

  return (
    <>
      <Script
        id="visatop-gtag-consent"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: bootstrap }}
      />
      <Script
        id="visatop-gtag"
        strategy="lazyOnload"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`}
      />
    </>
  );
}
