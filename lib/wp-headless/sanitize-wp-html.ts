import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "br",
  "button",
  "div",
  "em",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "section",
  "span",
  "strong",
  "svg",
  "path",
  "ul",
] as const;

const GLOBAL_ATTRS = ["class", "id", "title", "role", "aria-label", "aria-hidden"] as const;

const COMMON_ARIA_ATTRS = [
  "aria-current",
  "aria-expanded",
  "aria-controls",
  "aria-haspopup",
] as const;

/**
 * Sanitizes WP-provided header/footer HTML using a strict allowlist.
 * This is intentionally conservative: no scripts, no event handlers, no inline styles.
 */
export function sanitizeWpShellHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: {
      "*": [...GLOBAL_ATTRS],
      a: ["href", "target", "rel", ...GLOBAL_ATTRS, ...COMMON_ARIA_ATTRS],
      img: ["src", "alt", "width", "height", "loading", "decoding", ...GLOBAL_ATTRS],
      button: ["type", ...GLOBAL_ATTRS, ...COMMON_ARIA_ATTRS],
      svg: [
        "viewBox",
        "width",
        "height",
        "xmlns",
        "fill",
        "stroke",
        "aria-hidden",
        "focusable",
        ...GLOBAL_ATTRS,
      ],
      path: ["d", "fill", "stroke"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    transformTags: {
      a: (tagName, attribs) => {
        // Remove javascript: style links even if somehow encoded; sanitize-html already blocks schemes.
        const next: Record<string, string> = { ...attribs };
        const href = (next.href ?? "").trim();
        // Shell renders inside a srcdoc iframe. WP often emits target="_self" for same-site links;
        // that navigates *inside the iframe* (nested Next + HMR "Fast Refresh") instead of a real tab.
        const shouldOpenInNewTab =
          href.startsWith("http://") ||
          href.startsWith("https://") ||
          href.startsWith("/") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:");
        if (shouldOpenInNewTab) {
          next.target = "_blank";
          if (href.startsWith("http://") || href.startsWith("https://")) {
            const rel = (next.rel ?? "").split(/\s+/).filter(Boolean);
            if (!rel.includes("noopener")) rel.push("noopener");
            if (!rel.includes("noreferrer")) rel.push("noreferrer");
            next.rel = rel.join(" ");
          }
        }
        return { tagName, attribs: next };
      },
    },
  });
}

