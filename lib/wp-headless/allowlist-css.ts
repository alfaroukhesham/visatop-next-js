function normalizeHosts(hosts: string[]): Set<string> {
  const out = new Set<string>();
  for (const h of hosts) {
    const t = h.trim().toLowerCase();
    if (t) out.add(t);
  }
  return out;
}

export function allowlistWpCssUrls(
  urls: Array<string | null | undefined>,
  input: { allowedHosts: string[] }
): string[] {
  const allowed = normalizeHosts(input.allowedHosts);
  const deduped = new Set<string>();

  for (const raw of urls) {
    const t = (raw ?? "").trim();
    if (!t) continue;
    try {
      const u = new URL(t);
      if (u.protocol !== "https:") continue;
      if (!allowed.has(u.hostname.toLowerCase())) continue;
      deduped.add(u.toString());
    } catch {
      // skip invalid
    }
  }

  return [...deduped];
}

