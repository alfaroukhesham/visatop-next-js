import type { DbTransaction } from "@/lib/db";
import { application, applicationParty } from "@/lib/db/schema";
import { getApplyConfigFromTx, type TApplyConfig } from "@/lib/apply/apply-config";
import { listPublicServicesForNationality } from "@/lib/catalog/queries";
import type { TTravelerKind } from "@/lib/catalog/guided-choice";
import { computeDraftExpiresAt, getDraftTtlHoursFromTx } from "@/lib/applications/draft-ttl";
import type { CreateDraftTraveler } from "@/lib/applications/create-draft-body";

export type TCatalogServiceRow = { id: string; travelerKind: TTravelerKind };

export type TCreateTravelersAssertion =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Validate the requested travelers against apply-config and the priced catalog
 * for this nationality. Pure — takes pre-loaded rows so tests need no DB.
 */
export function assertCreateTravelers(
  travelers: CreateDraftTraveler[],
  applyConfig: Pick<TApplyConfig, "partyEnabled" | "partyMaxTravelers">,
  catalogRows: TCatalogServiceRow[],
): TCreateTravelersAssertion {
  if (travelers.length < 1) return { ok: false, message: "Choose a service." };
  if (!applyConfig.partyEnabled && travelers.length > 1) {
    return { ok: false, message: "This checkout is for one traveller only." };
  }
  if (travelers.length > applyConfig.partyMaxTravelers) {
    return {
      ok: false,
      message: `Maximum ${applyConfig.partyMaxTravelers} travellers per checkout.`,
    };
  }
  const byId = new Map(catalogRows.map((r) => [r.id, r]));
  for (const t of travelers) {
    const row = byId.get(t.serviceId);
    if (!row) return { ok: false, message: "Invalid nationality or service." };
    if (row.travelerKind !== t.kind) {
      return { ok: false, message: "Invalid nationality or service." };
    }
  }
  return { ok: true };
}

export type TCreatePartyDraftParams = {
  nationalityCode: string;
  catalogCurrency: "USD" | "AED";
  guestEmail: string | null;
  travelers: CreateDraftTraveler[];
  userId: string | null;
  isGuest: boolean;
  resumeTokenHash: string | null;
};

export type TCreatePartyDraftResult = {
  partyId: string;
  primaryApplicationId: string;
  memberIds: string[];
  primaryRow: typeof application.$inferSelect;
  ttlHours: number;
};

/**
 * Create a draft party + its applications in one transaction. Must run inside
 * `withSystemDbActor` (application_party has no client INSERT policy).
 */
export async function createPartyDraft(
  tx: DbTransaction,
  params: TCreatePartyDraftParams,
): Promise<TCreatePartyDraftResult> {
  const now = new Date();
  const [applyConfig, ttlHours] = await Promise.all([
    getApplyConfigFromTx(tx),
    getDraftTtlHoursFromTx(tx),
  ]);
  const catalogRows = await listPublicServicesForNationality(
    tx,
    params.nationalityCode,
    params.catalogCurrency,
  );
  const assertion = assertCreateTravelers(params.travelers, applyConfig, catalogRows);
  if (!assertion.ok) {
    throw new CreatePartyDraftValidationError(assertion.message);
  }

  const draftExpiresAt = computeDraftExpiresAt(now, ttlHours);
  const email = params.guestEmail?.trim() ? params.guestEmail.trim().toLowerCase() : null;

  const party = await tx
    .insert(applicationParty)
    .values({
      userId: params.userId,
      isGuest: params.isGuest,
      guestEmail: email,
      nationalityCode: params.nationalityCode,
      catalogCurrency: params.catalogCurrency,
      resumeTokenHash: params.resumeTokenHash,
      draftExpiresAt,
      paymentStatus: "unpaid",
    })
    .returning();

  const partyId = party[0]?.id;
  if (!partyId) throw new Error("Failed to create party");

  const members = await tx
    .insert(application)
    .values(
      params.travelers.map((t, index) => ({
        userId: params.userId,
        isGuest: params.isGuest,
        guestEmail: email,
        nationalityCode: params.nationalityCode,
        serviceId: t.serviceId,
        catalogCurrency: params.catalogCurrency,
        partyId,
        travelerRole: index === 0 ? "primary" : "additional",
        travelerKind: t.kind,
        travelerIndex: index,
        applicationStatus: "draft",
        paymentStatus: "unpaid",
        fulfillmentStatus: "not_started",
        draftExpiresAt,
        resumeTokenHash: params.resumeTokenHash,
      })),
    )
    .returning();

  const primary = members.find((m) => m.travelerRole === "primary");
  if (!primary) throw new Error("Failed to create primary application");

  return {
    partyId,
    primaryApplicationId: primary.id,
    memberIds: members.map((m) => m.id),
    primaryRow: primary,
    ttlHours,
  };
}

export class CreatePartyDraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatePartyDraftValidationError";
  }
}
