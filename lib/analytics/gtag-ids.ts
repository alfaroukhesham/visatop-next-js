/** Public Google tag IDs — match WordPress Site Kit. */
export const DEFAULT_GOOGLE_TAG_ID = "GT-MK4HNLVK";
export const DEFAULT_GA_MEASUREMENT_ID = "G-Z2581VYBE3";
export const DEFAULT_GADS_CONVERSION_ID = "AW-17767633830";

export function getGoogleTagId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_TAG_ID?.trim() || DEFAULT_GOOGLE_TAG_ID;
}

export function getGaMeasurementId(): string {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || DEFAULT_GA_MEASUREMENT_ID;
}

/** Empty string disables Ads config. */
export function getGadsConversionId(): string {
  const raw = process.env.NEXT_PUBLIC_GADS_CONVERSION_ID;
  if (raw === "") return "";
  return raw?.trim() || DEFAULT_GADS_CONVERSION_ID;
}
