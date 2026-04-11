/**
 * Detect Postgres `foreign_key_violation` (23503), including wrapped driver errors.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code: unknown }).code === "23503"
    ) {
      return true;
    }
    if (typeof current === "object" && current !== null && "cause" in current) {
      current = (current as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}
