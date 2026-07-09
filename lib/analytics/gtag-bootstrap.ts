import { SITE_KIT_CONSENT_REGIONS } from "@/lib/analytics/consent-regions";
import {
  getGadsConversionId,
  getGaMeasurementId,
  getGoogleTagId,
} from "@/lib/analytics/gtag-ids";

/**
 * Inline bootstrap: Consent Mode v2 (Site Kit defaults) → linker → Google tag config.
 * Must run before gtag/js so EU-region defaults apply.
 */
export function buildGoogleTagBootstrapScript(options?: {
  googleTagId?: string;
  gaMeasurementId?: string;
  gadsConversionId?: string;
}): string {
  const googleTagId = options?.googleTagId ?? getGoogleTagId();
  const gaMeasurementId = options?.gaMeasurementId ?? getGaMeasurementId();
  const gadsConversionId = options?.gadsConversionId ?? getGadsConversionId();
  const regionsJson = JSON.stringify([...SITE_KIT_CONSENT_REGIONS]);

  const adsConfig =
    gadsConversionId.length > 0
      ? `gtag('config', ${JSON.stringify(gadsConversionId)});`
      : "";

  // send_page_view:false — App Router SPA tracker owns page_view.
  return `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_personalization: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'denied',
  personalization_storage: 'denied',
  security_storage: 'denied',
  region: ${regionsJson},
  wait_for_update: 500
});
gtag('set', 'linker', { domains: ['visatop.com'] });
gtag('js', new Date());
gtag('config', ${JSON.stringify(googleTagId)}, { send_page_view: false });
gtag('config', ${JSON.stringify(gaMeasurementId)}, { send_page_view: false });
${adsConfig}
`.trim();
}
