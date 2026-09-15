export type TTrackParamValue = string | number | boolean | null | undefined;

export type TFunnelBeaconIds = {
  applicationId?: string;
  nationalityCode?: string;
  serviceId?: string;
};

const asOptionalString = (value: TTrackParamValue): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
};

const firstString = (...values: TTrackParamValue[]): string | undefined => {
  for (const value of values) {
    const parsed = asOptionalString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

export const funnelIdsFromTrackParams = (
  params: Record<string, TTrackParamValue>,
): TFunnelBeaconIds => ({
  applicationId: firstString(params.application_id, params.applicationId),
  nationalityCode: firstString(params.nationalityCode, params.nationality),
  serviceId: firstString(params.service_id, params.serviceId),
});
