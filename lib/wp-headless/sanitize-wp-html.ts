/**
 * Minimal HTML sanitization for WP-provided header/footer.
 *
 * We assume WP is controlled, but we still strip the most dangerous vectors:
 * - <script> tags
 * - inline event handlers (on*)
 * - javascript: URLs in href/src
 *
 * This is not a full HTML sanitizer. If we ever need stronger guarantees,
 * introduce a dedicated sanitizer library and a strict allowlist.
 */
export function sanitizeWpShellHtml(input: string): string {
  let out = input;

  // Drop script tags entirely.
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  // Drop inline event handlers like onclick="..."
  out = out.replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

  // Neutralize javascript: URLs in href/src attributes.
  out = out.replace(
    /\s(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi,
    ' $1="#"'
  );

  return out;
}

