import { extraIsPriced } from "@/lib/pricing/resolve-checkout-extras";

/**
 * One travel-insurance choice for the whole party.
 * Stored as the existing per-traveller rows, all set the same way.
 */

export const partyInsuranceMap = (
  memberIds: readonly string[],
  on: boolean,
): Record<string, boolean> => Object.fromEntries(memberIds.map((id) => [id, on]));

export const storedPartyInsuranceOn = (
  memberIds: readonly string[],
  stored: Readonly<Record<string, boolean>>,
): boolean => memberIds.some((id) => stored[id] === true);

/** A ticked party stays ticked when a traveller is added. A partial row set becomes all-on or all-off. */
export const expandPartyInsurance = (
  memberIds: readonly string[],
  stored: Readonly<Record<string, boolean>>,
): Record<string, boolean> => partyInsuranceMap(memberIds, storedPartyInsuranceOn(memberIds, stored));

export const nextPartyInsurance = (input: {
  memberIds: readonly string[];
  stored: Readonly<Record<string, boolean>>;
  insuranceForParty?: boolean;
  travelInsurance?: readonly { applicationId: string; selected: boolean }[];
}): Record<string, boolean> => {
  if (input.insuranceForParty !== undefined) {
    return partyInsuranceMap(input.memberIds, input.insuranceForParty);
  }
  if (input.travelInsurance) {
    const members = new Set(input.memberIds);
    const on = input.travelInsurance.some((row) => row.selected && members.has(row.applicationId));
    return partyInsuranceMap(input.memberIds, on);
  }
  return expandPartyInsurance(input.memberIds, input.stored);
};

export const normalizeInsuranceForQuote = (input: {
  memberIds: readonly string[];
  stored: Readonly<Record<string, boolean>>;
  insuranceAvailable: boolean;
}): { map: Record<string, boolean>; removed: boolean } => {
  const on = storedPartyInsuranceOn(input.memberIds, input.stored);
  if (!input.insuranceAvailable && on) {
    return { map: partyInsuranceMap(input.memberIds, false), removed: true };
  }
  return { map: expandPartyInsurance(input.memberIds, input.stored), removed: false };
};

export const insuranceSelectionChanged = (
  memberIds: readonly string[],
  before: Readonly<Record<string, boolean>>,
  after: Readonly<Record<string, boolean>>,
): boolean =>
  memberIds.some((id) => (before[id] === true) !== (after[id] === true));

export const insuranceOfferedForCurrency = (
  catalog: readonly { key: string; enabled: boolean; prices: readonly { currency: string }[] }[],
  currency: string,
): boolean => {
  const insurance = catalog.find((extra) => extra.key === "travel_insurance");
  return insurance ? extraIsPriced(insurance, currency) : false;
};

export const insuranceStepOffered = (
  preview: { availableExtras: readonly { key: string }[] } | null | undefined,
): boolean => Boolean(preview?.availableExtras.some((extra) => extra.key === "travel_insurance"));

/** Trip rail, before a quote exists: Extras is offered when the catalog has a priced, enabled row. */
export const insuranceCatalogOffered = (
  catalog: readonly { key: string; enabled: boolean; prices: readonly unknown[] }[],
): boolean => {
  const insurance = catalog.find((extra) => extra.key === "travel_insurance");
  return Boolean(insurance?.enabled && insurance.prices.length > 0);
};
