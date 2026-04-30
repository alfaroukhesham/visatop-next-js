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

/**
 * Sanitizes WP-provided header/footer HTML using a strict allowlist.
 * This is intentionally conservative: no scripts, no event handlers, no inline styles.
 */
export function sanitizeWpShellHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: {
      "*": [...GLOBAL_ATTRS, /^aria-[\w-]+$/, /^data-[\w-]+$/],
      a: ["href", "target", "rel", ...GLOBAL_ATTRS],
      img: ["src", "alt", "width", "height", "loading", "decoding", ...GLOBAL_ATTRS],
      button: ["type", "aria-expanded", "aria-controls", ...GLOBAL_ATTRS],
      svg: ["viewBox", "width", "height", "xmlns", "fill", "stroke", "aria-hidden", "focusable", ...GLOBAL_ATTRS],
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
        // Remove javascript: style links even if somehow encoded; sanitize-html already blocks schemes,
        // but we also normalize noopener defaults for any external navigation.
        const next: Record<string, string> = { ...attribs };
        if (next.target === "_blank") {
          const rel = (next.rel ?? "").split(/\s+/).filter(Boolean);
          if (!rel.includes("noopener")) rel.push("noopener");
          if (!rel.includes("noreferrer")) rel.push("noreferrer");
          next.rel = rel.join(" ");
        }
        return { tagName, attribs: next };
      },
    },
  });
}

