export type TTrackParamValue = string | number | boolean | null | undefined;

export type TFunnelBeaconIds = {
  applicationId?: string;
  nationalityCode?: string;
  serviceId?: string;
  failureReason?: string;
  errorCode?: string;
  httpStatus?: number;
  reason?: string;
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

const asOptionalHttpStatus = (...values: TTrackParamValue[]): number | undefined => {
  for (const value of values) {
    const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isInteger(n) && n >= 100 && n <= 599) return n;
  }
  return undefined;
};

export const funnelIdsFromTrackParams = (
  params: Record<string, TTrackParamValue>,
): TFunnelBeaconIds => {
  const failureReason = firstString(params.failureReason);
  return {
    applicationId: firstString(params.application_id, params.applicationId),
    nationalityCode: firstString(params.nationalityCode, params.nationality),
    serviceId: firstString(params.service_id, params.serviceId),
    ...(failureReason ? { failureReason } : {}),
    errorCode: firstString(params.error_code, params.errorCode),
    httpStatus: asOptionalHttpStatus(params.http_status, params.httpStatus),
    reason: firstString(params.failure_reason, params.reason, failureReason),
  };
};
