import { buildDeferredScriptLoader } from "@/lib/analytics/deferred-script-loader";
import { META_PIXEL_ID } from "@/lib/analytics/meta-pixel-id";

/**
 * Official Meta Pixel base snippet (Events Manager).
 * PageView on first load lives here; SPA navigations fire additional PageViews.
 * The fbq stub + queue is defined immediately; fbevents.js itself is injected on first
 * interaction or after load + idle fallback, then replays the queue.
 */
export const buildMetaPixelBootstrapScript = (pixelId = META_PIXEL_ID): string =>
  `
!function(f,n)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[]}(window);
${buildDeferredScriptLoader({ id: "visatop-fbevents", src: "https://connect.facebook.net/en_US/fbevents.js" })}
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');
`.trim();
