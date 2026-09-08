import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { generateResumeToken } from "@/lib/applications/resume-token";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application, applicationParty } from "@/lib/db/schema";

export const RESUME_EMAIL_LINK_MAX_TTL_SEC = 48 * 3600;

export type TResumePayload = {
  partyId: string;
  primaryApplicationId: string;
  exp: number;
};

const RESUMABLE_PAYMENT_STATUSES = new Set(["unpaid", "checkout_created"]);

/** `true` when signing / verification can run (UTF-8 length ≥ 32 bytes). */
export const isResumeEmailLinkSecretConfigured = (): boolean => {
  const s = process.env.GUEST_LINK_INTENT_SECRET?.trim();
  return Boolean(s && Buffer.byteLength(s, "utf8") >= 32);
};

const requireResumeEmailLinkSecret = (): string => {
  const s = process.env.GUEST_LINK_INTENT_SECRET?.trim();
  if (!s || Buffer.byteLength(s, "utf8") < 32) {
    throw new Error("GUEST_LINK_INTENT_SECRET must be set to at least 32 bytes");
  }
  return s;
};

export const computeResumeEmailLinkExpSec = (
  draftExpiresAt: Date,
  nowSec: number = Math.floor(Date.now() / 1000),
): number => {
  const draftExpSec = Math.floor(draftExpiresAt.getTime() / 1000);
  const maxExp = nowSec + RESUME_EMAIL_LINK_MAX_TTL_SEC;
  return Math.min(maxExp, draftExpSec);
};

export const signResumeEmailLink = (
  partyId: string,
  primaryApplicationId: string,
  draftExpiresAt: Date,
  opts?: { secret?: string; nowSec?: number },
): string => {
  const secret = opts?.secret ?? requireResumeEmailLinkSecret();
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const exp = computeResumeEmailLinkExpSec(draftExpiresAt, nowSec);
  const payload = JSON.stringify({ partyId, primaryApplicationId, exp } satisfies TResumePayload);
  const mac = createHmac("sha256", secret).update(payload, "utf8").digest();
  const pB64 = Buffer.from(payload, "utf8").toString("base64url");
  const mB64 = mac.toString("base64url");
  return `${pB64}.${mB64}`;
};

export const verifyResumeEmailLink = (
  token: string,
  opts?: { secret?: string; nowSec?: number },
): { ok: true; partyId: string; primaryApplicationId: string } | { ok: false } => {
  let secret: string;
  try {
    secret = opts?.secret ?? requireResumeEmailLinkSecret();
  } catch {
    return { ok: false };
  }
  const nowSec = opts?.nowSec ?? Math.floor(Date.now() / 1000);
  const parts = token.split(".");
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
  let data: TResumePayload;
  try {
    data = JSON.parse(payload) as TResumePayload;
  } catch {
    return { ok: false };
  }
  if (
    typeof data.partyId !== "string" ||
    typeof data.primaryApplicationId !== "string" ||
    typeof data.exp !== "number"
  ) {
    return { ok: false };
  }
  if (nowSec > data.exp) return { ok: false };
  return { ok: true, partyId: data.partyId, primaryApplicationId: data.primaryApplicationId };
};

export type TConsumeResumeEmailLinkResult =
  | { ok: true; plainToken: string; maxAgeSeconds: number; primaryApplicationId: string }
  | { ok: false };

export const consumeResumeEmailLink = async (signedToken: string): Promise<TConsumeResumeEmailLinkResult> => {
  const verified = verifyResumeEmailLink(signedToken);
  if (!verified.ok) return { ok: false };

  return withSystemDbActor(async (tx) => {
    const [party] = await tx
      .select()
      .from(applicationParty)
      .where(eq(applicationParty.id, verified.partyId))
      .for("update")
      .limit(1);
    if (!party) return { ok: false };

    const members = await tx
      .select({ id: application.id })
      .from(application)
      .where(eq(application.partyId, party.id));
    const memberIds = new Set(members.map((m) => m.id));
    if (!memberIds.has(verified.primaryApplicationId)) return { ok: false };

    const now = new Date();
    if (party.draftExpiresAt && party.draftExpiresAt < now) return { ok: false };
    if (!RESUMABLE_PAYMENT_STATUSES.has(party.paymentStatus)) return { ok: false };

    const { plainToken, hash } = generateResumeToken();
    await tx
      .update(applicationParty)
      .set({ resumeTokenHash: hash, updatedAt: now })
      .where(eq(applicationParty.id, party.id));
    await tx
      .update(application)
      .set({ resumeTokenHash: hash, updatedAt: now })
      .where(eq(application.partyId, party.id));

    const maxAgeSeconds = party.draftExpiresAt
      ? Math.max(0, Math.floor((party.draftExpiresAt.getTime() - now.getTime()) / 1000))
      : RESUME_EMAIL_LINK_MAX_TTL_SEC;

    return {
      ok: true,
      plainToken,
      maxAgeSeconds,
      primaryApplicationId: verified.primaryApplicationId,
    };
  });
};
