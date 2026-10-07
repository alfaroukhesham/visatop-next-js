import type { ReactElement } from "react";
import { headers } from "next/headers";
import { GoogleTag } from "@/components/analytics/google-tag";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { areMarketingTagsEnabledFromHeaders } from "@/lib/analytics/marketing-tags-enabled";

/**
 * Loads Google tag + Ads config + Meta Pixel on production Host only.
 * Does not load the WordPress GTM container (Ads conversion labels / triggers
 * do not match checkout; see `lib/analytics/marketing-tags-enabled.ts`).
 */
export const MarketingTags = async (): Promise<ReactElement | null> => {
  const requestHeaders = await headers();
  if (!areMarketingTagsEnabledFromHeaders(requestHeaders)) {
    return null;
  }

  return (
    <>
      <GoogleTag />
      <MetaPixel />
    </>
  );
};
