/** Polylang slug persisted for customer apply/track shell (not HttpOnly — parent may set it). */
export const CUSTOMER_LOCALE_COOKIE = "vt_locale";

/** Set by `proxy.ts` from `?locale=` so the first RSC render sees the slug. */
export const CUSTOMER_LOCALE_REQUEST_HEADER = "x-vt-locale";

/** ~1 year */
export const CUSTOMER_LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Fallback when WordPress language inventory is unavailable (proxy, offline dev).
 * Ops source of truth: `GET {WP_ORIGIN}/wp-json/pll/v1/languages`.
 */
export const FALLBACK_CUSTOMER_LOCALE_SLUGS = [
  "en",
  "fr",
  "es",
  "it",
  "tr",
  "ar",
  "de",
  "hi",
  "tl",
  "ru",
  "ha",
] as const;

export type TCustomerLocaleSlug = (typeof FALLBACK_CUSTOMER_LOCALE_SLUGS)[number];

export interface ICustomerLocaleOption {
  slug: string;
  name: string;
  isRtl: boolean;
}

const normalizeSlugList = (knownSlugs: Iterable<string>): Set<string> =>
  new Set(
    [...knownSlugs]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

export interface IResolveCustomerLocaleInput {
  headerValue?: string | null;
  cookieValue?: string | null;
  knownSlugs?: Iterable<string>;
}

/** Query/header from proxy wins so `?locale=` applies on the same request as Set-Cookie. */
export const resolveCustomerLocale = ({
  headerValue,
  cookieValue,
  knownSlugs,
}: IResolveCustomerLocaleInput): string => {
  const header = (headerValue ?? "").trim();
  if (header) return parseCustomerLocale(header, knownSlugs);
  return parseCustomerLocale(cookieValue, knownSlugs);
};

/**
 * Parse a Polylang slug from query/cookie. Unknown or empty → `en`.
 * Only slugs present in `knownSlugs` (or the cached fallback list) are accepted.
 */
export const parseCustomerLocale = (
  raw: string | null | undefined,
  knownSlugs: Iterable<string> = FALLBACK_CUSTOMER_LOCALE_SLUGS,
): string => {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "en";

  const normalized = trimmed.toLowerCase();
  const slugSet = normalizeSlugList(knownSlugs);
  if (slugSet.has(normalized)) return normalized;

  if (/^[a-z]{2}$/.test(normalized)) {
    for (const slug of slugSet) {
      if (slug === normalized) return normalized;
    }
  }

  return "en";
};

/** True when the raw query value maps to a known slug (not junk coerced to en). */
export const isValidCustomerLocaleParam = (
  raw: string | null | undefined,
  knownSlugs: Iterable<string> = FALLBACK_CUSTOMER_LOCALE_SLUGS,
): boolean => {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  return parseCustomerLocale(normalized, knownSlugs) === normalized;
};

export const customerLocaleCookieOptions = (opts?: { secure?: boolean }) => {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  return {
    path: "/",
    sameSite: "lax" as const,
    maxAge: CUSTOMER_LOCALE_MAX_AGE_SECONDS,
    httpOnly: false,
    secure,
  };
};

export const buildCustomerLocaleSetCookieValue = (
  slug: string,
  opts?: { secure?: boolean },
): string => {
  const { path, sameSite, maxAge, secure } = customerLocaleCookieOptions(opts);
  const parts = [
    `${CUSTOMER_LOCALE_COOKIE}=${encodeURIComponent(slug)}`,
    `Max-Age=${maxAge}`,
    `Path=${path}`,
    `SameSite=${sameSite === "lax" ? "Lax" : sameSite}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
};

export const readCustomerLocaleFromCookieHeader = (
  cookieHeader: string | null | undefined,
  knownSlugs?: Iterable<string>,
): string => {
  if (!cookieHeader?.trim()) return "en";
  const prefix = `${CUSTOMER_LOCALE_COOKIE}=`;
  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    if (!p.startsWith(prefix)) continue;
    const raw = p.slice(prefix.length);
    try {
      return parseCustomerLocale(decodeURIComponent(raw), knownSlugs);
    } catch {
      return parseCustomerLocale(raw, knownSlugs);
    }
  }
  return "en";
};

export interface IPlanCustomerLocaleSwitchInput {
  href: string;
  slug: string;
}

export interface IPlanCustomerLocaleSwitchResult {
  slug: string;
  nextPath: string;
  sameUrl: boolean;
}

/** Keep `?locale=` in sync with the switcher so URL and cookie stay interchangeable. */
export const withCustomerLocaleQuery = (href: string, slug: string): string => {
  const url = new URL(href, "https://visatop.com");
  url.searchParams.set("locale", slug);
  return `${url.pathname}${url.search}${url.hash}`;
};

export const planCustomerLocaleSwitch = ({
  href,
  slug,
}: IPlanCustomerLocaleSwitchInput): IPlanCustomerLocaleSwitchResult => {
  const normalized = parseCustomerLocale(slug);
  const nextPath = withCustomerLocaleQuery(href, normalized);
  const current = new URL(href, "https://visatop.com");
  const currentPath = `${current.pathname}${current.search}${current.hash}`;
  return {
    slug: normalized,
    nextPath,
    sameUrl: nextPath === currentPath,
  };
};

export const isCustomerLocaleRtl = (slug: string): boolean => slug === "ar";
