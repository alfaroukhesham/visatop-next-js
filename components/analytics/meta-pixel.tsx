import type { FC } from "react";
import Script from "next/script";
import { buildMetaPixelBootstrapScript } from "@/lib/analytics/meta-pixel-bootstrap";
import { buildMetaPixelNoscriptSrc } from "@/lib/analytics/meta-pixel-id";

/**
 * Loads Meta Pixel on customer pages (Events Manager base code).
 * Admin is out of this tree — same placement as Google Tag.
 */
export const MetaPixel: FC = () => {
  return (
    <>
      <Script
        id="visatop-meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: buildMetaPixelBootstrapScript() }}
      />
      <noscript>
        {/* Meta Events Manager noscript fallback — not a content image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height={1}
          width={1}
          style={{ display: "none" }}
          src={buildMetaPixelNoscriptSrc()}
          alt=""
        />
      </noscript>
    </>
  );
};
