/** Meta Pixel ID from Events Manager. */
export const META_PIXEL_ID = "951709640813169";

export const buildMetaPixelNoscriptSrc = (pixelId = META_PIXEL_ID): string =>
  `https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`;
