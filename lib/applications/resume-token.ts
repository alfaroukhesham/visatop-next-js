import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashResumeToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function generateResumeToken(): { plainToken: string; hash: string } {
  const plainToken = randomBytes(32).toString("base64url");
  return { plainToken, hash: hashResumeToken(plainToken) };
}

export function verifyResumeToken(plainToken: string, storedHash: string): boolean {
  try {
    const a = Buffer.from(hashResumeToken(plainToken), "utf8");
    const b = Buffer.from(storedHash, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type TGuestResumeTokenState = {
  resumeTokenHash: string | null | undefined;
  previousResumeTokenHash?: string | null;
  previousResumeTokenExpiresAt?: Date | null;
};

export type TGuestResumeTokenMatchKind = "current" | "previous";

/** Current hash, or previous hash still inside its grace window. */
export const guestResumeTokenMatchKind = (
  plainToken: string,
  state: TGuestResumeTokenState,
  now: Date = new Date(),
): TGuestResumeTokenMatchKind | null => {
  if (state.resumeTokenHash && verifyResumeToken(plainToken, state.resumeTokenHash)) {
    return "current";
  }
  if (
    !state.previousResumeTokenHash ||
    !state.previousResumeTokenExpiresAt ||
    state.previousResumeTokenExpiresAt.getTime() <= now.getTime()
  ) {
    return null;
  }
  return verifyResumeToken(plainToken, state.previousResumeTokenHash) ? "previous" : null;
};

export const guestResumeTokenMatches = (
  plainToken: string,
  state: TGuestResumeTokenState,
  now: Date = new Date(),
): boolean => guestResumeTokenMatchKind(plainToken, state, now) !== null;
