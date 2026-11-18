export const resolveLocalCurrencyPriceNationality = (
  linkedNationalityCodes: readonly string[],
  currentPriceNationality: string,
): string => {
  if (linkedNationalityCodes.includes(currentPriceNationality)) {
    return currentPriceNationality;
  }
  return linkedNationalityCodes[0] ?? "";
};