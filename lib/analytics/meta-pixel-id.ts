/** Meta Pixel ID from Events Manager (existing pixel — leave untouched). */
export const META_PIXEL_ID = "951709640813169";

/** WebisteVisa pixel — funnel events target this id only. */
export const WEBISTE_VISA_PIXEL_ID = "1098702859698634";

export const META_PIXEL_IDS = [META_PIXEL_ID, WEBISTE_VISA_PIXEL_ID] as const;

export const buildMetaPixelNoscriptSrc = (pixelId = META_PIXEL_ID): string =>
  `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`;
