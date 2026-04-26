import { createHmac, timingSafeEqual } from "node:crypto";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";

export const LINK_INTENT_COOKIE_NAME = "vt_link_intent";

/** §6 — 30 minutes */
export const GUEST_LINK_INTENT_TTL_SEC = 1800;

type Payload = { applicationId: string; exp: number };

/** `true` when signing / verification can run (UTF-8 length ≥ 32 bytes). */
export function isGuestLinkIntentSecretConfigured(): boolean {
  const s = process.env.GUEST_LINK_INTENT_SECRET?.trim();
  return Boolean(s && Buffer.byteLength(s, "utf8") >= 32);
}

function requireIntentSecret(): string {
  const s = process.env.GUEST_LINK_INTENT_SECRET?.trim();
  if (!s || Buffer.byteLength(s, "utf8") < 32) {
    throw new Error("GUEST_LINK_INTENT_SECRET must be set to at least 32 bytes");
  }
  return s;
}

export function signGuestLinkIntent(
  applicationId: string,
  opts?: { secret?: string; nowSec?: number },
): string {
  const secret = opts?.secret ?? requireIntentSecret();
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = nowSec + GUEST_LINK_INTENT_TTL_SEC;
  const payload = JSON.stringify({ applicationId, exp } satisfies Payload);
  const mac = createHmac("sha256", secret).update(payload, "utf8").digest();
  const pB64 = Buffer.from(payload, "utf8").toString("base64url");
  const mB64 = mac.toString("base64url");
  return `${pB64}.${mB64}`;
}

export function verifyGuestLinkIntent(
  cookieValue: string,
  opts?: { secret?: string; nowSec?: number },
): { ok: true; applicationId: string } | { ok: false } {
  let secret: string;
  try {
    secret = opts?.secret ?? requireIntentSecret();
  } catch {
    return { ok: false };
  }
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return { ok: false };
  const [pB64, mB64] = parts;
  let payload: string;
  try {
    payload = Buffer.from(pB64, "base64url").toString("utf8");
  } catch {
    return { ok: false };
  }
  const expectedMac = createHmac("sha256", secret).update(payload, "utf8").digest();
  let gotMac: Buffer;
  try {
    gotMac = Buffer.from(mB64, "base64url");
  } catch {
    return { ok: false };
  }
  if (expectedMac.length !== gotMac.length || !timingSafeEqual(expectedMac, gotMac)) {
    return { ok: false };
  }
  let data: Payload;
  try {
    data = JSON.parse(payload) as Payload;
  } catch {
    return { ok: false };
  }
  if (typeof data.applicationId !== "string" || typeof data.exp !== "number") {
    return { ok: false };
  }
  if (nowSec > data.exp) return { ok: false };
  return { ok: true, applicationId: data.applicationId };
}

export function buildLinkIntentSetCookieValue(
  plainIntent: string,
  opts?: { secure?: boolean },
): string {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  const parts = [
    `${LINK_INTENT_COOKIE_NAME}=${encodeURIComponent(plainIntent)}`,
    `Max-Age=${GUEST_LINK_INTENT_TTL_SEC}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildLinkIntentClearCookieValue(opts?: { secure?: boolean }): string {
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  const parts = [`${LINK_INTENT_COOKIE_NAME}=`, "Max-Age=0", "Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readLinkIntentFromRequestCookies(cookieHeader: string | null): string | null {
  return readResumeTokenFromRequestCookies(cookieHeader, LINK_INTENT_COOKIE_NAME);
}
