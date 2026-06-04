export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Run independent chunk work concurrently (same transaction when `fn` uses one `tx`). */
export async function applyChunksInParallel<T>(
  items: T[],
  chunkSize: number,
  fn: (chunk: T[]) => Promise<void>,
): Promise<void> {
  const chunks = chunkArray(items, chunkSize);
  if (chunks.length === 0) return;
  await Promise.all(chunks.map((chunk) => (chunk.length > 0 ? fn(chunk) : Promise.resolve())));
}
