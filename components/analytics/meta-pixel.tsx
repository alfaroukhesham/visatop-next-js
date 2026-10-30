import type { FC } from "react";
import Script from "next/script";
import { buildMetaPixelBootstrapScript } from "@/lib/analytics/meta-pixel-bootstrap";
import {
  buildMetaPixelNoscriptSrc,
  META_PIXEL_IDS,
} from "@/lib/analytics/meta-pixel-id";

/**
 * Loads Meta Pixel on customer pages (Events Manager base code).
 * One fbevents.js load inits every listed pixel. Admin is out of this tree.
 */
export const MetaPixel: FC = () => {
  return (
    <>
      <Script
        id="visatop-meta-pixel"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{ __html: buildMetaPixelBootstrapScript() }}
      />
      <noscript>
        {/* Meta Events Manager noscript fallback — not a content image. */}
        {META_PIXEL_IDS.map((pixelId) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={pixelId}
            height={1}
            width={1}
            style={{ display: "none" }}
            src={buildMetaPixelNoscriptSrc(pixelId)}
            alt=""
          />
        ))}
      </noscript>
    </>
  );
};
