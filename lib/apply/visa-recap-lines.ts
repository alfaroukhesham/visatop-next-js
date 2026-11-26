export type TVisaRecapItem = {
  key: string;
  label: string;
  amountMinor: bigint | null;
};

export type TVisaRecapGroup = {
  key: string;
  label: string;
  count: number;
  amountMinor: bigint | null;
};

export const parseVisaAmountMinor = (value: string | null | undefined): bigint | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
};

const recapBucket = (item: TVisaRecapItem): string =>
  `${item.key}\u0000${item.amountMinor === null ? "" : item.amountMinor.toString()}`;

/** One row per service and unit amount, in first-seen order. The label is display only. */
export const groupVisaRecapLines = (items: readonly TVisaRecapItem[]): TVisaRecapGroup[] => {
  const groups: TVisaRecapGroup[] = [];
  const byServiceAmount = new Map<string, TVisaRecapGroup>();
  for (const item of items) {
    const label = item.label.trim();
    if (!label) continue;
    const existing = byServiceAmount.get(recapBucket(item));
    if (!existing) {
      const group: TVisaRecapGroup = {
        key: item.key,
        label,
        count: 1,
        amountMinor: item.amountMinor,
      };
      byServiceAmount.set(recapBucket(item), group);
      groups.push(group);
      continue;
    }
    existing.count += 1;
    if (existing.amountMinor === null || item.amountMinor === null) {
      existing.amountMinor = null;
    } else {
      existing.amountMinor += item.amountMinor;
    }
  }
  return groups;
};

/** Empty when every traveller shares one visa, so callers keep the single-visa layout. */
export const mixedVisaGroups = (items: readonly TVisaRecapItem[]): TVisaRecapGroup[] => {
  const groups = groupVisaRecapLines(items);
  return groups.length > 1 ? groups : [];
};
