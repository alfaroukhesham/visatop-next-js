"use client";

import { analyticsDeviceType } from "@/lib/analytics/device-type";
import { trackEvent } from "@/lib/analytics/gtag-client";
import { persistableUploadFunnelEventName } from "@/lib/analytics/upload-funnel-event";
import type { TUploadFailureReason } from "@/lib/analytics/upload-failure";

export type TDocumentUploadSource = "camera" | "file";

export const trackDocumentUploadAnalytics = (input: {
  docType: string;
  applicationId: string;
  success: boolean;
  source?: TDocumentUploadSource;
  failureReason?: TUploadFailureReason;
}): void => {
  const persistableName = persistableUploadFunnelEventName(input.docType, input.success);
  const eventName = persistableName ?? (input.docType === "passport_copy" || input.docType === "personal_photo"
    ? "document_upload_failed"
    : null);
  if (!eventName) return;
  trackEvent(eventName, {
    application_id: input.applicationId,
    success: input.success,
    device_type: analyticsDeviceType(),
    upload_source: input.source,
    failure_reason: input.failureReason,
  });
};
