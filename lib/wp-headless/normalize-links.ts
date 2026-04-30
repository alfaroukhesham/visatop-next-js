import type { NormalizedWpLink } from "./types";

function normalizeOrigin(raw: string): string | null {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeBasePath(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const withSlash = t.startsWith("/") ? t : `/${t}`;
  return withSlash === "/" ? "" : withSlash.replace(/\/$/, "");
}

function stripBasePath(pathname: string, basePath: string): string | null {
  if (!basePath) return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return null;
}

export function normalizeWpMenuUrl(input: {
  url: string | undefined | null;
  label: string | undefined | null;
  appBasePath: string;
  appOrigin: string;
}): NormalizedWpLink {
  const label = (input.label ?? "").trim() || "Untitled";
  const url = (input.url ?? "").trim();
  const basePath = normalizeBasePath(input.appBasePath);
  const appOrigin = normalizeOrigin(input.appOrigin);

  if (!url) return { kind: "external", href: "#", label };

  // Relative path: internal only if it targets the app mount.
  if (url.startsWith("/")) {
    try {
      const u = new URL(url, "http://local.invalid");
      const stripped = stripBasePath(u.pathname, basePath);
      if (stripped == null) return { kind: "external", href: url, label };
      const href = (stripped || "/") + (u.search || "") + (u.hash || "");
      return { kind: "internal", href, label };
    } catch {
      const stripped = stripBasePath(url, basePath);
      if (stripped == null) return { kind: "external", href: url, label };
      return { kind: "internal", href: stripped || "/", label };
    }
  }

  // Absolute URL.
  try {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`.toLowerCase();
    if (appOrigin && origin === appOrigin) {
      const stripped = stripBasePath(u.pathname, basePath);
      if (stripped != null) {
        const href = (stripped || "/") + (u.search || "") + (u.hash || "");
        return { kind: "internal", href, label };
      }
    }
    return { kind: "external", href: url, label };
  } catch {
    return { kind: "external", href: "#", label };
  }
}

