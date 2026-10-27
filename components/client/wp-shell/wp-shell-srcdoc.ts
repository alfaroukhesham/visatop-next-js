/** Parent/iframe compact breakpoint — same 414px used for the 118px header reserve. */
export const WP_SHELL_COMPACT_MAX_WIDTH_PX = 414;

const GOOGLE_FONTS_HREF_RE = /fonts\.google(apis|static)/i;

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}

export const WP_SHELL_COMPACT_MQ = `(max-width: ${WP_SHELL_COMPACT_MAX_WIDTH_PX}px)`;

/**
 * Prod (#50) featured-logo rules. Staging #53 replaced width:auto with a 64×16 lock
 * that shrank Khaleej Times on desktop; keep the prod rule as the default.
 */
export const WP_SHELL_DESKTOP_FEATURED_LOGO_CSS = `
      header#header .featured_on .inner a img {
        height: 16px;
        width: auto;
        max-width: 100%;
        object-fit: contain;
        filter: brightness(0) invert(1);
      }
`;

/**
 * #53 header iframe locks — Inter CSP companion CSS, 180×40 VisaTop logo, 64×16
 * featured logos. Applied only when the iframe viewport is 414px or less.
 */
export const WP_SHELL_COMPACT_HEADER_OVERRIDES_CSS = `
      @media (max-width: ${WP_SHELL_COMPACT_MAX_WIDTH_PX}px) {
        header#header .logo picture { display: block; height: 40px; width: auto; max-width: 220px; }
        header#header .logo img {
          display: block;
          height: 40px;
          width: 180px;
          max-width: 220px;
          object-fit: contain;
        }
        header#header .featured_on .inner a img {
          height: 16px;
          width: 64px;
          max-width: 64px;
          object-fit: contain;
          filter: brightness(0) invert(1);
        }
        @font-face{
          font-family:Inter;
          font-style:normal;
          font-weight:100 900;
          src:local("Arial"),local("Helvetica Neue"),local("sans-serif");
          font-display:optional;
          unicode-range:U+0-10FFFF;
        }
        @font-face{
          font-family:Inter;
          font-style:italic;
          font-weight:100 900;
          src:local("Arial"),local("Helvetica Neue"),local("sans-serif");
          font-display:optional;
          unicode-range:U+0-10FFFF;
        }
        html,body,header#header,header#header *{
          font-family:ui-sans-serif,system-ui,sans-serif !important;
        }
      }
`;

export function wpShellStylesheetLinks(input: {
  cssUrls: string[];
  kind: "header" | "footer";
}): string {
  return input.cssUrls
    .filter((href): href is string => Boolean(href))
    .map((href) => {
      const media =
        input.kind === "header" && GOOGLE_FONTS_HREF_RE.test(href)
          ? ` media="screen and (min-width: ${WP_SHELL_COMPACT_MAX_WIDTH_PX + 1}px)"`
          : "";
      return `<link rel="stylesheet" href="${escapeAttr(href)}"${media}>`;
    })
    .join("\n");
}

export function wpShellHeaderCspMeta(input: {
  kind: "header" | "footer";
  compactHeader: boolean;
}): string {
  if (input.kind !== "header" || !input.compactHeader) return "";
  return `<meta http-equiv="Content-Security-Policy" content="font-src 'none'">`;
}

export function sizeWpShellHeaderImages(html: string, compactHeader: boolean): string {
  if (!compactHeader) return html;
  return html
    .replace(
      /<img\b([^>]*\balt="VisaTop"[^>]*)>/i,
      (_full, attrs: string) =>
        /\bwidth\s*=/.test(attrs) && /\bheight\s*=/.test(attrs)
          ? `<img${attrs}>`
          : `<img width="180" height="40"${attrs}>`,
    )
    .replace(/<img\b([^>]*)>/gi, (full, attrs: string) =>
      /\bwidth\s*=/.test(attrs) && /\bheight\s*=/.test(attrs)
        ? full
        : `<img width="64" height="16"${attrs}>`,
    );
}
