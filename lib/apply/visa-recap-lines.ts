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

/** One row per distinct customer-facing visa name, in first-seen order. */
export const groupVisaRecapLines = (items: readonly TVisaRecapItem[]): TVisaRecapGroup[] => {
  const groups: TVisaRecapGroup[] = [];
  const byLabel = new Map<string, TVisaRecapGroup>();
  for (const item of items) {
    const label = item.label.trim();
    if (!label) continue;
    const existing = byLabel.get(label);
    if (!existing) {
      const group: TVisaRecapGroup = {
        key: item.key,
        label,
        count: 1,
        amountMinor: item.amountMinor,
      };
      byLabel.set(label, group);
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
