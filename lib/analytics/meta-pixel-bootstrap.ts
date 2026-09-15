import { META_PIXEL_ID } from "@/lib/analytics/meta-pixel-id";

/**
 * Official Meta Pixel base snippet (Events Manager).
 * PageView on first load lives here; SPA navigations fire additional PageViews.
 */
export const buildMetaPixelBootstrapScript = (pixelId = META_PIXEL_ID): string =>
  `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');
`.trim();
