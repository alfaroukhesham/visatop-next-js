import { META_PIXEL_IDS } from "@/lib/analytics/meta-pixel-id";

/**
 * Official Meta Pixel base snippet (Events Manager).
 * One fbevents.js load; every listed pixel is inited; PageView reaches all of them.
 * SPA navigations fire additional PageViews via `trackMetaPageView`.
 */
export const buildMetaPixelBootstrapScript = (
  pixelIds: readonly string[] = META_PIXEL_IDS,
): string => {
  const inits = pixelIds
    .map((pixelId) => `fbq('init', ${JSON.stringify(pixelId)});`)
    .join("\n");
  return `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
${inits}
fbq('track', 'PageView');
try{window.dispatchEvent(new Event('visatop:meta-pixel-ready'));}catch(e){}
`.trim();
};
