import type { TTravelerKind } from "@/lib/catalog/guided-choice";

export type TPartyTravelerDraft = {
  key: string;
  kind: TTravelerKind;
  serviceId: string;
};

export const canAddTraveler = (count: number, max: number): boolean => count < max;

export const assertTravelersReady = (
  travelers: TPartyTravelerDraft[],
  max: number,
): { ok: true } | { ok: false; message: string } => {
  if (travelers.length < 1) return { ok: false, message: "Add at least one traveller." };
  if (travelers.length > max) {
    return { ok: false, message: `Maximum ${max} travellers per checkout.` };
  }
  if (travelers.some((t) => !t.serviceId)) {
    return { ok: false, message: "Choose a visa for every traveller." };
  }
  return { ok: true };
};
