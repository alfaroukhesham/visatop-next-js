import { allowlistWpCssUrls } from "./allowlist-css";
import { normalizeWpMenuUrl } from "./normalize-links";
import { sanitizeWpShellHtml } from "./sanitize-wp-html";
import { fetchWordpressRestJson } from "./wordpress-rest";
import type {
  NormalizedWpMenuItem,
  WpHeadlessLayoutResponse,
  WpLanguageOptionRaw,
  WpMenuItemRaw,
  WpShellLanguageOption,
  WpShellModel,
} from "./types";

function toId(item: WpMenuItemRaw, idx: number): string {
  const raw = item.id ?? idx;
  return String(raw);
}

function toLabel(item: WpMenuItemRaw): string {
  return (item.title ?? item.label ?? "").trim() || "Untitled";
}

function normalizeMenuTree(input: {
  items: WpMenuItemRaw[] | null | undefined;
  appBasePath: string;
  appOrigin: string;
}): NormalizedWpMenuItem[] {
  const items = input.items ?? [];

  const walk = (node: WpMenuItemRaw, idx: number): NormalizedWpMenuItem => {
    const label = toLabel(node);
    return {
      id: toId(node, idx),
      label,
      link: normalizeWpMenuUrl({
        url: node.url,
        label,
        appBasePath: input.appBasePath,
        appOrigin: input.appOrigin,
      }),
      children: (node.children ?? []).map((c, j) => walk(c, j)),
    };
  };

  return items.map((n, i) => walk(n, i));
}

function parseAllowedHostsFromEnv(): string[] {
  const raw = process.env.WP_PUBLIC_ASSET_HOSTS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const normalizeLayoutLanguageOption = (
  raw: WpLanguageOptionRaw,
  currentSlug: string,
): WpShellLanguageOption | null => {
  const slug = (raw.slug ?? "").trim().toLowerCase();
  if (!slug) return null;
  const name = (raw.name ?? slug).trim() || slug;
  return {
    slug,
    name,
    isRtl: raw.is_rtl === true || slug === "ar",
    isCurrent: raw.current === true || slug === currentSlug,
  };
};

const parseLayoutLanguage = (
  json: WpHeadlessLayoutResponse,
  requestedLang?: string,
): WpShellModel["language"] => {
  const block = json.language;
  const current = (block?.current ?? requestedLang ?? "en").trim().toLowerCase() || "en";
  const availableRaw = block?.available ?? [];
  const available = availableRaw
    .map((item) => normalizeLayoutLanguageOption(item, current))
    .filter((item): item is WpShellLanguageOption => item !== null);
  if (available.length === 0) return null;
  return { current, available };
};

function resolveAllowedCssHosts(input: { wpOrigin: string }): string[] {
  const explicit = parseAllowedHostsFromEnv();
  if (explicit.length > 0) return explicit;
  try {
    // Zero-config safe default: only allow css hosted on the WP origin hostname.
    return [new URL(input.wpOrigin).hostname];
  } catch {
    return [];
  }
}

export async function fetchWpShellModel(input: {
  wpOrigin: string;
  appOrigin: string;
  appBasePath: string;
  lang?: string;
  revalidateSeconds?: number;
  includeHtml?: boolean;
}): Promise<WpShellModel | null> {
  const include = input.includeHtml ? "menus,css,html" : "menus,css";
  const revalidateSeconds = input.revalidateSeconds ?? 60;
  const searchParams: Record<string, string> = { include };
  if (input.lang) searchParams.lang = input.lang;

  const fetched = await fetchWordpressRestJson({
    wpOrigin: input.wpOrigin,
    route: "/headless/v1/layout",
    searchParams,
    revalidateSeconds,
  });

  if (!fetched) {
    return null;
  }

  let json: WpHeadlessLayoutResponse;
  try {
    json = (await fetched.res.json()) as WpHeadlessLayoutResponse;
  } catch {
    return null;
  }

  const headerMenu = normalizeMenuTree({
    items: json.menus?.header_menu ?? [],
    appBasePath: input.appBasePath,
    appOrigin: input.appOrigin,
  });

  const footerMenu = normalizeMenuTree({
    items: json.menus?.footer_menu ?? [],
    appBasePath: input.appBasePath,
    appOrigin: input.appOrigin,
  });

  const cssUrls = allowlistWpCssUrls(
    (json.css ?? []).map((a) => a.url ?? undefined),
    { allowedHosts: resolveAllowedCssHosts({ wpOrigin: input.wpOrigin }) }
  );

  const headerHtmlRaw = input.includeHtml ? ((json.html?.header ?? null) || null) : null;
  const footerHtmlRaw = input.includeHtml ? ((json.html?.footer ?? null) || null) : null;

  const headerHtml = headerHtmlRaw ? sanitizeWpShellHtml(headerHtmlRaw) : null;
  const footerHtml = footerHtmlRaw ? sanitizeWpShellHtml(footerHtmlRaw) : null;

  return {
    headerMenu,
    footerMenu,
    cssUrls,
    headerHtml,
    footerHtml,
    language: parseLayoutLanguage(json, input.lang),
  };
}

