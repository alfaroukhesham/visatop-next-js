/**
 * Runtime gate for third-party marketing tags (Google tag / Ads / Meta Pixel).
 *
 * Staging and prod can share the same Docker image (`alfarouk1995/visatop-next`),
 * so a build-time `NEXT_PUBLIC_*` flag cannot separate them. This check uses the
 * request Host at render time and fails closed.
 *
 * GTM-T6D7X53B is not loaded on checkout: the container has Clarity `ytynrsf6c5`
 * and Google tag `AW-17767633830`, but it has no conversion label
 * `AW-17767633830/THfyCPCPh-wcEKanophC` and its extra trigger is WordPress
 * `form_submit`. Loading it would not reproduce checkout Ads conversions and
 * would add TikTok + Bing tags. See PR-E.
 */
export const PRODUCTION_MARKETING_HOSTS = ["visatop.com", "www.visatop.com"] as const;

export const CHECKOUT_LOADS_GTM_CONTAINER = false;

const INTERNAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", ""]);

export type TMarketingTagsHeaders = {
  get: (name: string) => string | null;
};

export const parseRequestHostname = (headerValue: string | null | undefined): string => {
  const raw = headerValue?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!raw) return "";
  const withoutDot = raw.endsWith(".") ? raw.slice(0, -1) : raw;
  if (withoutDot.startsWith("[")) {
    const end = withoutDot.indexOf("]");
    return end === -1 ? withoutDot : withoutDot.slice(1, end);
  }
  const colon = withoutDot.lastIndexOf(":");
  if (colon !== -1 && /^\d+$/.test(withoutDot.slice(colon + 1))) {
    return withoutDot.slice(0, colon);
  }
  return withoutDot;
};

export const isProductionMarketingHost = (hostname: string): boolean => {
  return (PRODUCTION_MARKETING_HOSTS as readonly string[]).includes(hostname);
};

export const isInternalHostname = (hostname: string): boolean => {
  if (INTERNAL_HOSTS.has(hostname)) return true;
  return hostname.endsWith(".local") || hostname.endsWith(".internal");
};

/** Runtime kill switch: only an explicit off-value disables prod. Unset does not. */
export const isMarketingTagsKillSwitchOff = (raw: string | undefined): boolean => {
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "false" || normalized === "0" || normalized === "off" || normalized === "no";
};

export const areMarketingTagsEnabled = (input: {
  hostname: string;
  forwardedHostname?: string;
  envFlag?: string;
}): boolean => {
  if (isMarketingTagsKillSwitchOff(input.envFlag)) return false;
  const hostName = parseRequestHostname(input.hostname);
  const forwardedName = parseRequestHostname(input.forwardedHostname);
  if (hostName && !isInternalHostname(hostName) && !isProductionMarketingHost(hostName)) {
    return false;
  }
  return isProductionMarketingHost(forwardedName) || isProductionMarketingHost(hostName);
};

export const areMarketingTagsEnabledFromHeaders = (
  requestHeaders: TMarketingTagsHeaders,
  envFlag = process.env.ENABLE_MARKETING_TAGS,
): boolean => {
  return areMarketingTagsEnabled({
    hostname: requestHeaders.get("host") ?? "",
    forwardedHostname: requestHeaders.get("x-forwarded-host") ?? "",
    envFlag,
  });
};
