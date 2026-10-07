"use client";

import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";
import { analyticsDeviceType } from "@/lib/analytics/device-type";
import { trackEvent } from "@/lib/analytics/gtag-client";
import { uploadAnalyticsEventName } from "@/lib/analytics/upload-funnel-event";
import { passportFailureCode, type TUploadFailureReason } from "@/lib/analytics/upload-failure";

export type TDocumentUploadSource = "camera" | "file";

export const trackDocumentUploadAnalytics = (input: {
  docType: string;
  applicationId: string;
  success: boolean;
  cancelled?: boolean;
  source?: TDocumentUploadSource;
  failureReason?: TUploadFailureReason;
  httpStatus?: number;
  errorCode?: string;
}): void => {
  const eventName = uploadAnalyticsEventName({
    docType: input.docType,
    outcome: input.cancelled ? "cancelled" : input.success ? "success" : "failed",
  });
  const closedReason = input.failureReason ? passportFailureCode(input.failureReason) : undefined;
  if (eventName) {
    trackEvent(eventName, {
      application_id: input.applicationId,
      success: input.success,
      device_type: analyticsDeviceType(),
      upload_source: input.source,
      failure_reason: input.failureReason,
      http_status: input.httpStatus,
      error_code: input.errorCode,
    });
  }
  if (input.docType !== "passport_copy") return;
  if (input.success) {
    trackEvent(APPLY_FUNNEL_EVENTS.passportUploadSucceeded, {
      application_id: input.applicationId,
    });
    return;
  }
  trackEvent(APPLY_FUNNEL_EVENTS.passportUploadFailed, {
    application_id: input.applicationId,
    failureReason: closedReason,
    error_code: closedReason,
  });
};
