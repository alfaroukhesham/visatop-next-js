/**
 * Shared authorization for client-facing application routes.
 *
 * Accepts either:
 * - A Better Auth session (signed-in user) → the caller must use
 *   `withClientDbActor(session.user.id, ...)` inside the returned wrapper.
 * - A guest `vt_resume` cookie matching the application's `resume_token_hash`
 *   → the caller must use `withSystemDbActor(...)`.
 *
 * Returns a discriminated union so the route handler can switch on the actor
 * type and call the correct db wrapper.
 */
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { readResumeTokenFromRequestCookies } from "@/lib/applications/resume-cookie";
import { verifyResumeToken } from "@/lib/applications/resume-token";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";

export type ApplicationAccess =
  | {
      kind: "user";
      userId: string;
      isGuest: false;
    }
  | {
      kind: "guest";
      userId: null;
      isGuest: true;
    };

export type ApplicationAccessFailure =
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not_found" };

/**
 * Resolve whether the current request has access to `applicationId`. For
 * guests, verifies the `vt_resume` cookie matches the stored token hash
 * (constant-time). Does NOT load the full row — routes re-read inside their
 * own actor-scoped transaction so RLS can do its job.
 *
 * Guest resume is evaluated before session ownership so a logged-in user can
 * continue a guest application with `withSystemDbActor` when the cookie is valid.
 */
export async function resolveApplicationAccess(
  req: Request,
  hdrs: Headers,
  applicationId: string,
): Promise<{ ok: true; access: ApplicationAccess } | { ok: false; failure: ApplicationAccessFailure }> {
  const session = await auth.api.getSession({ headers: hdrs });
  const token = readResumeTokenFromRequestCookies(req.headers.get("cookie"));

  if (token) {
    const verified = await withSystemDbActor(async (tx) => {
      const rows = await tx
        .select({
          id: application.id,
          resumeTokenHash: application.resumeTokenHash,
          isGuest: application.isGuest,
        })
        .from(application)
        .where(eq(application.id, applicationId))
        .limit(1);
      const row = rows[0];
      if (!row) return { present: false, verified: false } as const;
      if (!row.resumeTokenHash || !row.isGuest) {
        return { present: true, verified: false } as const;
      }
      if (!verifyResumeToken(token, row.resumeTokenHash)) {
        return { present: true, verified: false } as const;
      }
      return { present: true, verified: true } as const;
    });

    if (!verified.present) return { ok: false, failure: { kind: "not_found" } };
    if (verified.verified) {
      return {
        ok: true,
        access: { kind: "guest", userId: null, isGuest: true },
      };
    }
    if (verified.present && !verified.verified && !session) {
      return { ok: false, failure: { kind: "forbidden" } };
    }
  }

  if (!session) {
    return { ok: false, failure: { kind: "forbidden" } };
  }

  const owned = await withSystemDbActor(async (tx) => {
    const rows = await tx
      .select({
        userId: application.userId,
        isGuest: application.isGuest,
      })
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!owned) return { ok: false, failure: { kind: "not_found" } };
  if (owned.isGuest) {
    return { ok: false, failure: { kind: "forbidden" } };
  }
  if (!owned.userId || owned.userId !== session.user.id) {
    return { ok: false, failure: { kind: "forbidden" } };
  }

  return {
    ok: true,
    access: { kind: "user", userId: session.user.id, isGuest: false },
  };
}
