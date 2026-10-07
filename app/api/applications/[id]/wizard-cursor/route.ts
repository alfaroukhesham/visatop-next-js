import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { loadPartyMembers } from "@/lib/applications/load-party-members";
import { cursorIsAhead, type TApplyWizardCursor, type TApplyWizardScreen } from "@/lib/apply/apply-wizard";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { applicationParty } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.strictObject({
  screen: z.enum(["ready", "passport", "other", "details"]),
  travellerId: z.string().min(1).max(80).nullable(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const [{ id }, parsed] = await Promise.all([ctx.params, parseJsonBody(req, bodySchema, requestId)]);
  if (!parsed.ok) return parsed.response;

  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row?.partyId) {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }

  const screen = parsed.data.screen as TApplyWizardScreen;
  const travellerId = screen === "ready" ? null : parsed.data.travellerId;
  if (screen !== "ready" && !travellerId) {
    return jsonError("VALIDATION_ERROR", "Traveller is required", { status: 400, requestId });
  }

  const saved = await withSystemDbActor(async (tx) => {
    const members = await loadPartyMembers(tx, row);
    if (travellerId && !members.some((member) => member.applicationId === travellerId)) {
      return { ok: false as const };
    }
    const [party] = await tx
      .select({
        screen: applicationParty.wizardCursorScreen,
        travellerId: applicationParty.wizardCursorTravellerId,
      })
      .from(applicationParty)
      .where(eq(applicationParty.id, row.partyId!))
      .limit(1);
    const previousScreen = party?.screen;
    const previous: TApplyWizardCursor | null =
      previousScreen === "ready" ||
      previousScreen === "passport" ||
      previousScreen === "other" ||
      previousScreen === "details"
        ? { screen: previousScreen, travellerId: party?.travellerId ?? null }
        : null;
    const next: TApplyWizardCursor = { screen, travellerId };
    const order = members.map((member) => ({
      applicationId: member.applicationId,
      hasPassport: true,
    }));
    if (previous && !cursorIsAhead(order, previous, next)) {
      return { ok: true as const };
    }
    await tx
      .update(applicationParty)
      .set({
        wizardCursorScreen: screen,
        wizardCursorTravellerId: travellerId,
        updatedAt: new Date(),
      })
      .where(eq(applicationParty.id, row.partyId!));
    return { ok: true as const };
  });

  if (!saved.ok) {
    return jsonError("VALIDATION_ERROR", "Traveller is not on this application", {
      status: 400,
      requestId,
    });
  }
  return jsonOk({ saved: true }, { requestId });
}
