import { allowlistWpCssUrls } from "./allowlist-css";
import { normalizeWpMenuUrl } from "./normalize-links";
import { sanitizeWpShellHtml } from "./sanitize-wp-html";
import type {
  NormalizedWpMenuItem,
  WpHeadlessLayoutResponse,
  WpMenuItemRaw,
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
}): Promise<WpShellModel | null> {
  const include = "menus,css,html";
  const url = new URL("/wp-json/headless/v1/layout", input.wpOrigin);
  url.searchParams.set("include", include);
  if (input.lang) url.searchParams.set("lang", input.lang);

  const revalidateSeconds = input.revalidateSeconds ?? 60;

  let json: WpHeadlessLayoutResponse;
  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: revalidateSeconds },
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    json = (await res.json()) as WpHeadlessLayoutResponse;
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

  const headerHtmlRaw = (json.html?.header ?? null) || null;
  const footerHtmlRaw = (json.html?.footer ?? null) || null;

  const headerHtml = headerHtmlRaw ? sanitizeWpShellHtml(headerHtmlRaw) : null;
  const footerHtml = footerHtmlRaw ? sanitizeWpShellHtml(footerHtmlRaw) : null;

  return {
    headerMenu,
    footerMenu,
    cssUrls,
    headerHtml,
    footerHtml,
  };
}

