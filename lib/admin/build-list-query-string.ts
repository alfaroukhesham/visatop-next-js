/** Builds URLSearchParams, omitting empty / undefined values. */
export function buildListQueryString(
  entries: Record<string, string | number | boolean | undefined | null>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean") {
      if (value) qs.set(key, "true");
      continue;
    }
    qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}
