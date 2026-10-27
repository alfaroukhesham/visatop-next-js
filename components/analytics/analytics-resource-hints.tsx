import type { FC, ReactElement } from "react";
import {
  CLARITY_PRECONNECT_ORIGINS,
  MARKETING_DNS_PREFETCH_ORIGINS,
  MARKETING_PRECONNECT_ORIGINS,
} from "@/lib/analytics/resource-hint-origins";

interface IAnalyticsResourceHintsProps {
  includeMarketing?: boolean;
}

/**
 * Warm the third-party origins used by Clarity and (on production) marketing tags
 * without competing for the first-step JS parse.
 */
export const AnalyticsResourceHints: FC<IAnalyticsResourceHintsProps> = ({
  includeMarketing = false,
}): ReactElement => {
  return (
    <>
      {CLARITY_PRECONNECT_ORIGINS.map((href) => (
        <link key={href} rel="preconnect" href={href} />
      ))}
      {includeMarketing
        ? MARKETING_PRECONNECT_ORIGINS.map((href) => (
            <link key={href} rel="preconnect" href={href} />
          ))
        : null}
      {includeMarketing
        ? MARKETING_DNS_PREFETCH_ORIGINS.map((href) => (
            <link key={href} rel="dns-prefetch" href={href} />
          ))
        : null}
    </>
  );
};
