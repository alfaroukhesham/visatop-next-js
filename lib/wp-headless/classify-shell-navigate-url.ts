import { normalizeWpMenuUrl } from "./normalize-links";

export type TWpShellNavigateTarget =
  | { mode: "internal"; path: string }
  | { mode: "external"; url: string };

const resolveAbsoluteHref = (href: string, wpBaseHref: string | null): string => {
  const trimmed = href.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  const fallbackBase =
    wpBaseHref?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "https://visatop.com");
  const baseWithSlash = fallbackBase.endsWith("/") ? fallbackBase : `${fallbackBase}/`;
  try {
    return new URL(trimmed, baseWithSlash).href;
  } catch {
    return trimmed;
  }
};

/**
 * Classify a WP shell iframe link click for parent navigation.
 * Internal targets use Next.js router paths (basePath stripped).
 */
export const classifyWpShellNavigateUrl = (input: {
  href: string;
  wpBaseHref: string | null;
  appBasePath: string;
  appOrigin: string;
}): TWpShellNavigateTarget => {
  const absolute = resolveAbsoluteHref(input.href, input.wpBaseHref);
  const normalized = normalizeWpMenuUrl({
    url: absolute,
    label: "",
    appBasePath: input.appBasePath,
    appOrigin: input.appOrigin,
  });

  if (normalized.kind === "internal") {
    return { mode: "internal", path: normalized.href };
  }

  const externalUrl = normalized.href === "#" ? absolute : normalized.href;
  return { mode: "external", url: externalUrl };
};
