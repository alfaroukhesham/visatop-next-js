import { headers } from "next/headers";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import {
  assertApplicationStatusAdminTransition,
  assertPaidForOps,
  isAdminWorkflowApplicationStatus,
} from "@/lib/admin-api/application-ops-transitions";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { isMailgunConfigured } from "@/lib/email/mailgun";
import { resolveApplicantEmailTx } from "@/lib/email/resolve-applicant-email";
import {
  sendOutcomeApprovedEmail,
  sendOutcomeUaeAuthorityRejectionEmail,
} from "@/lib/email/send-application-transactional-emails";
import {
  APPLICATION_STATUSES,
  TERMINAL_APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/applications/status";
import * as schema from "@/lib/db/schema";
import { DOCUMENT_STATUS, DOCUMENT_TYPE } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBodySchema = z
  .object({
    adminOpsStep: z.union([z.string().trim().max(200), z.literal("")]).optional(),
    applicationStatus: z.enum(APPLICATION_STATUSES as unknown as [string, ...string[]]).optional(),
    outcomeDocumentId: z.string().min(1).optional(),
  })
  .refine((b) => b.adminOpsStep !== undefined || b.applicationStatus !== undefined, {
    message: "Provide adminOpsStep and/or applicationStatus",
  })
  .superRefine((b, ctx) => {
    if (b.applicationStatus === "completed" || b.applicationStatus === "rejection_by_uae_authorities") {
      if (!b.outcomeDocumentId) {
        ctx.addIssue({
          code: "custom",
          message: "outcomeDocumentId is required for this status",
          path: ["outcomeDocumentId"],
        });
      }
    }
    if (
      b.adminOpsStep !== undefined &&
      b.applicationStatus !== undefined &&
      TERMINAL_APPLICATION_STATUSES.has(b.applicationStatus as ApplicationStatus)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Do not combine adminOpsStep with a terminal applicationStatus in one request.",
        path: ["adminOpsStep"],
      });
    }
  });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;

  const parsed = await parseJsonBody(req, patchBodySchema, requestId);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;

  type EmailJob =
    | { kind: "outcome_approved"; outcomeDocumentId: string }
    | { kind: "outcome_uae_rejection"; outcomeDocumentId: string };

  return runAdminDbJson(requestId, ["applications.write", "audit.write"], async ({ tx, adminUserId }) => {
    const [row] = await tx
      .select()
      .from(schema.application)
      .where(eq(schema.application.id, applicationId))
      .for("update")
      .limit(1);

    if (!row) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }

    try {
      assertPaidForOps(row.paymentStatus);
    } catch {
      return jsonError("INVALID_OPS_STATE", "Application must be paid before admin ops updates.", {
        status: 400,
        requestId,
      });
    }

    let emailJob: EmailJob | null = null;
    let workingStatus = row.applicationStatus as ApplicationStatus;

    if (body.applicationStatus !== undefined) {
      const toStatus = body.applicationStatus as ApplicationStatus;
      const fromStatus = row.applicationStatus as ApplicationStatus;
      try {
        assertApplicationStatusAdminTransition(fromStatus, toStatus);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "invalid";
        return jsonError("INVALID_TRANSITION", msg.replace(/^INVALID_TRANSITION:/, "") || msg, {
          status: 400,
          requestId,
        });
      }

      if (toStatus === "completed") {
        const [doc] = await tx
          .select({ id: schema.applicationDocument.id })
          .from(schema.applicationDocument)
          .where(
            and(
              eq(schema.applicationDocument.id, body.outcomeDocumentId!),
              eq(schema.applicationDocument.applicationId, applicationId),
              eq(schema.applicationDocument.documentType, DOCUMENT_TYPE.OUTCOME_APPROVAL),
              eq(schema.applicationDocument.status, DOCUMENT_STATUS.RETAINED),
            ),
          )
          .limit(1);
        if (!doc) {
          return jsonError(
            "VALIDATION_ERROR",
            "Outcome document not found or is not a retained outcome approval upload.",
            { status: 400, requestId },
          );
        }
        emailJob = { kind: "outcome_approved", outcomeDocumentId: doc.id };
      } else if (toStatus === "rejection_by_uae_authorities") {
        const [doc] = await tx
          .select({ id: schema.applicationDocument.id })
          .from(schema.applicationDocument)
          .where(
            and(
              eq(schema.applicationDocument.id, body.outcomeDocumentId!),
              eq(schema.applicationDocument.applicationId, applicationId),
              eq(schema.applicationDocument.documentType, DOCUMENT_TYPE.OUTCOME_AUTHORITY_REJECTION),
              eq(schema.applicationDocument.status, DOCUMENT_STATUS.RETAINED),
            ),
          )
          .limit(1);
        if (!doc) {
          return jsonError(
            "VALIDATION_ERROR",
            "Outcome document not found or is not a retained UAE authority rejection upload.",
            { status: 400, requestId },
          );
        }
        emailJob = { kind: "outcome_uae_rejection", outcomeDocumentId: doc.id };
      }

      await tx
        .update(schema.application)
        .set({ applicationStatus: toStatus })
        .where(eq(schema.application.id, applicationId));

      await writeAdminAudit(tx, {
        adminUserId,
        action: "application.transition.applicationStatus",
        entityType: "application",
        entityId: applicationId,
        beforeJson: JSON.stringify({ applicationStatus: fromStatus }),
        afterJson: JSON.stringify({ applicationStatus: toStatus, outcomeDocumentId: body.outcomeDocumentId }),
      });

      workingStatus = toStatus;
    }

    if (body.adminOpsStep !== undefined) {
      if (!isAdminWorkflowApplicationStatus(workingStatus)) {
        return jsonError(
          "INVALID_OPS_STATE",
          "adminOpsStep can only be set while application status is in_progress or awaiting_authority.",
          { status: 400, requestId },
        );
      }
      const nextStep = body.adminOpsStep === "" ? null : body.adminOpsStep;
      const beforeStep = row.adminOpsStep;
      await tx.update(schema.application).set({ adminOpsStep: nextStep }).where(eq(schema.application.id, applicationId));
      await writeAdminAudit(tx, {
        adminUserId,
        action: "application.admin_ops_step",
        entityType: "application",
        entityId: applicationId,
        beforeJson: JSON.stringify({ adminOpsStep: beforeStep }),
        afterJson: JSON.stringify({ adminOpsStep: nextStep }),
      });
    }

    const [updated] = await tx.select().from(schema.application).where(eq(schema.application.id, applicationId)).limit(1);

    let transactionalEmail: string | null = null;
    if (emailJob) {
      if (!isMailgunConfigured()) {
        transactionalEmail = "skipped_mailgun_not_configured";
        console.warn(
          "[admin/ops] Outcome email not queued: set MAILGUN_API_KEY and MAILGUN_DOMAIN in the server environment.",
          { applicationId },
        );
      } else {
        const to = await resolveApplicantEmailTx(tx, updated!);
        if (!to) {
          transactionalEmail = "skipped_no_recipient";
          console.warn(
            "[admin/ops] Outcome email not queued: no applicant email (guestEmail empty and no user email).",
            { applicationId },
          );
        } else {
          transactionalEmail = "queued";
          const job = emailJob;
          if (job.kind === "outcome_approved") {
            after(() => {
              void sendOutcomeApprovedEmail(applicationId, job.outcomeDocumentId, requestId).catch((err) => {
                console.error("[admin/ops] outcome approved email failed", {
                  applicationId,
                  requestId,
                  err: err instanceof Error ? err.message : err,
                });
              });
            });
          } else {
            after(() => {
              void sendOutcomeUaeAuthorityRejectionEmail(applicationId, job.outcomeDocumentId, requestId).catch(
                (err) => {
                  console.error("[admin/ops] UAE rejection email failed", {
                    applicationId,
                    requestId,
                    err: err instanceof Error ? err.message : err,
                  });
                },
              );
            });
          }
        }
      }
    }

    return jsonOk(
      {
        application: {
          id: updated!.id,
          applicationStatus: updated!.applicationStatus,
          adminOpsStep: updated!.adminOpsStep,
        },
        transactionalEmail,
      },
      { requestId },
    );
  });
}
