export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    const ms = Date.parse(parsed.createdAt);
    if (!Number.isFinite(ms)) return null;
    // Normalize to ISO to keep comparisons stable.
    const createdAt = new Date(ms).toISOString();
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function parseLimit(
  raw: string | null,
  opts?: { defaultLimit?: number; max?: number },
) {
  const def = opts?.defaultLimit ?? 5;
  const max = opts?.max ?? 50;
  const n = raw ? Number(raw) : def;
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

