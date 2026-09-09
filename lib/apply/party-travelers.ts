import type { TTravelerKind } from "@/lib/catalog/guided-choice";

export type TPartyTravelerDraft = {
  key: string;
  kind: TTravelerKind;
  serviceId: string;
};

export type TTravelersReadyErrorCode = "addAtLeastOne" | "maxTravelers" | "chooseVisaForAll";

export type TTravelersReadyResult =
  | { ok: true }
  | { ok: false; code: TTravelersReadyErrorCode; missingKeys?: string[] };

export const missingTravelerVisaKeys = (travelers: TPartyTravelerDraft[]): string[] =>
  travelers.filter((t) => !t.serviceId.trim()).map((t) => t.key);

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
): TTravelersReadyResult => {
  if (travelers.length < 1) return { ok: false, code: "addAtLeastOne" };
  if (travelers.length > max) {
    return { ok: false, code: "maxTravelers" };
  }
  const missingKeys = missingTravelerVisaKeys(travelers);
  if (missingKeys.length > 0) {
    return { ok: false, code: "chooseVisaForAll", missingKeys };
  }
  return { ok: true };
};
