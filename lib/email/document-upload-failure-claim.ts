import { and, eq, isNull } from "drizzle-orm";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { documentUploadFailureNotification } from "@/lib/db/schema";

export type TDocumentUploadFailureRecord =
  typeof documentUploadFailureNotification.$inferSelect;

export type TClaimDocumentUploadFailureInput = {
  applicationId: string;
  documentType: string;
  failureGroup: string;
  errorCode: string;
  httpStatus: number;
  applicantNotified: boolean;
  locale: string;
};

/**
 * Inserts the open-failure row. Unique on (application, document type, failure
 * group) while `resolved_at` is null — retries of the same failure are no-ops.
 */
export const tryClaimDocumentUploadFailure = async (
  input: TClaimDocumentUploadFailureInput,
): Promise<TDocumentUploadFailureRecord | null> => {
  return withSystemDbActor(async (tx) => {
    try {
      const [row] = await tx
        .insert(documentUploadFailureNotification)
        .values({
          applicationId: input.applicationId,
          documentType: input.documentType,
          failureGroup: input.failureGroup,
          errorCode: input.errorCode,
          httpStatus: input.httpStatus,
          applicantNotified: input.applicantNotified,
          locale: input.locale,
        })
        .returning();
      return row ?? null;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  });
};

/**
 * Marks every open failure for this application + document type as resolved.
 * Each returned row is a failure record that has not yet been recovered.
 */
export const tryClaimDocumentUploadResolved = async (
  applicationId: string,
  documentType: string,
  now: Date = new Date(),
): Promise<TDocumentUploadFailureRecord[]> => {
  return withSystemDbActor(async (tx) => {
    return tx
      .update(documentUploadFailureNotification)
      .set({ resolvedAt: now })
      .where(
        and(
          eq(documentUploadFailureNotification.applicationId, applicationId),
          eq(documentUploadFailureNotification.documentType, documentType),
          isNull(documentUploadFailureNotification.resolvedAt),
        ),
      )
      .returning();
  });
};
