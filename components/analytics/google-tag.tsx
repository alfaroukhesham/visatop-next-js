import Script from "next/script";
import { buildDeferredScriptLoader } from "@/lib/analytics/deferred-script-loader";
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
 * The remote gtag.js is injected on first interaction or after load + idle fallback
 * (see deferred-script-loader) so it stays out of boot TBT; the inline bootstrap stays
 * `afterInteractive` so dataLayer/gtag events (page_view, checkout, purchase) queue.
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
        id="visatop-gtag-loader"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: buildDeferredScriptLoader({
            id: "visatop-gtag",
            src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`,
          }),
        }}
      />
    </>
  );
}
