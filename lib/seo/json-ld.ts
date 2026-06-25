/** Safe JSON-LD payload for inline `<script type="application/ld+json">`. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
