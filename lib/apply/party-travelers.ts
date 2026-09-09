import type { TTravelerKind } from "@/lib/catalog/guided-choice";

export type TPartyTravelerDraft = {
  key: string;
  kind: TTravelerKind;
  serviceId: string;
};

export type TTravelersReadyErrorCode = "addAtLeastOne" | "maxTravelers" | "chooseVisaForAll";

export const canAddTraveler = (count: number, max: number): boolean => count < max;

/** When the party shortlist has one visa, select it so checkout totals include that traveller. */
export const resolvePartyTravelerServiceId = (
  shortlist: ReadonlyArray<{ id: string }>,
  currentServiceId: string,
): string => {
  if (shortlist.length === 1) return shortlist[0].id;
  if (currentServiceId && shortlist.some((s) => s.id === currentServiceId)) {
    return currentServiceId;
  }
  return "";
};

export const assertTravelersReady = (
  travelers: TPartyTravelerDraft[],
  max: number,
): { ok: true } | { ok: false; code: TTravelersReadyErrorCode } => {
  if (travelers.length < 1) return { ok: false, code: "addAtLeastOne" };
  if (travelers.length > max) {
    return { ok: false, code: "maxTravelers" };
  }
  if (travelers.some((t) => !t.serviceId)) {
    return { ok: false, code: "chooseVisaForAll" };
  }
  return { ok: true };
};
