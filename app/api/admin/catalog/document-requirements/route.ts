import { headers } from "next/headers";
import { z } from "zod";
import { listEligibilityByNationality } from "@/lib/admin/catalog/list-eligibility-by-nationality";
import { listCatalogDocumentRequirements } from "@/lib/admin/catalog/list-catalog-document-requirements";
import {
  assignDocumentRequirements,
  removeDocumentRequirements,
  removeOneDocumentRequirement,
} from "@/lib/admin/catalog/document-requirement-assign";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseLimit } from "@/lib/api/cursor";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const pairSchema = z.object({
  nationalityCode: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((s) => s.toUpperCase()),
  serviceId: z.string().min(1),
});

export const assignBodySchema = z.object({
  documentType: z.enum(["bank_statement_6m"]),
  role: z.enum(["required", "additional"]),
  pairs: z.array(pairSchema).min(1).max(2000),
});

export const removeBodySchema = z.object({
  documentType: z.enum(["bank_statement_6m"]),
  pairs: z.array(pairSchema).min(1).max(2000),
});

export const removeOneBodySchema = z.object({
  id: z.string().min(1),
});

const messageFor = (code: string): string => {
  switch (code.replace("DOCUMENT_REQUIREMENTS_", "")) {
    case "TYPE_INVALID":
      return "Document type is not assignable";
    case "PAIRS_EMPTY":
      return "At least one nationality/service pair is required";
    case "PAIR_LIMIT":
      return "Too many pairs (max 2000)";
    case "UNKNOWN_REF":
      return "Unknown nationality or service";
    case "NOT_FOUND":
      return "Document requirement not found";
    default:
      return "Document requirement operation failed";
  }
};

const mapDocumentRequirementError = (
  e: unknown,
  requestId: string | null,
): Response | null => {
  const code =
    typeof e === "object" && e !== null && "code" in e
      ? String((e as { code: unknown }).code)
      : "";
  if (!code.startsWith("DOCUMENT_REQUIREMENTS_")) return null;
  const status = code === "DOCUMENT_REQUIREMENTS_NOT_FOUND" ? 404 : 400;
  return jsonError(code as ApiErrorCode, messageFor(code), { status, requestId });
};

const parsePage = (raw: string | null): number => {
  const n = raw ? Number(raw) : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const url = new URL(req.url);

  if (url.searchParams.get("picker") === "1") {
    return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
      const countries = await listEligibilityByNationality(tx);
      return jsonOk({ countries }, { requestId });
    });
  }

  const page = parsePage(url.searchParams.get("page"));
  const pageSize = parseLimit(url.searchParams.get("pageSize"), {
    defaultLimit: 10,
    max: 100,
  });
  const serviceId = url.searchParams.get("serviceId")?.trim() || undefined;
  const nationalityRaw = url.searchParams.get("nationalityCode")?.trim();
  const nationalityCode =
    nationalityRaw && /^[A-Za-z]{2}$/.test(nationalityRaw)
      ? nationalityRaw.toUpperCase()
      : undefined;
  const documentType = url.searchParams.get("documentType")?.trim() || undefined;

  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const { items, total } = await listCatalogDocumentRequirements(tx, {
      limit: pageSize,
      offset: page * pageSize,
      nationalityCode,
      serviceId,
      documentType,
    });
    return jsonOk({ items, total, page, pageSize }, { requestId });
  });
}

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, assignBodySchema, requestId);
      if (!parsed.ok) return parsed.response;

      const { documentType, role, pairs } = parsed.data;
      let result: { pairCount: number; eligibilityCreated: number; upserted: number };
      try {
        result = await assignDocumentRequirements(tx, {
          documentType,
          role,
          pairs,
        });
      } catch (e) {
        const mapped = mapDocumentRequirementError(e, requestId);
        if (mapped) return mapped;
        throw e;
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.document_requirement.bulk_assign",
        entityType: "catalog_document_requirement",
        entityId: null,
        afterJson: JSON.stringify({
          documentType,
          role,
          nationalityCodes: [...new Set(pairs.map((p) => p.nationalityCode))],
          serviceIds: [...new Set(pairs.map((p) => p.serviceId))],
          pairCount: result.pairCount,
          eligibilityCreated: result.eligibilityCreated,
          upserted: result.upserted,
        }),
      });

      return jsonOk(result, { requestId });
    },
  );
}

export async function DELETE(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return jsonError("VALIDATION_ERROR", "Malformed JSON body", {
          status: 400,
          requestId,
        });
      }

      if (
        typeof raw === "object" &&
        raw !== null &&
        "id" in raw &&
        typeof (raw as { id: unknown }).id === "string" &&
        (raw as { id: string }).id.length > 0
      ) {
        const parsed = removeOneBodySchema.safeParse(raw);
        if (!parsed.success) {
          const flat = parsed.error.flatten();
          return jsonError("VALIDATION_ERROR", "Request body failed validation", {
            status: 400,
            requestId,
            details: { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
          });
        }
        try {
          await removeOneDocumentRequirement(tx, parsed.data.id);
        } catch (e) {
          const mapped = mapDocumentRequirementError(e, requestId);
          if (mapped) return mapped;
          throw e;
        }
        await writeAdminAudit(tx, {
          adminUserId,
          action: "catalog.document_requirement.remove",
          entityType: "catalog_document_requirement",
          entityId: parsed.data.id,
          afterJson: JSON.stringify({ id: parsed.data.id }),
        });
        return jsonOk({ deleted: 1 }, { requestId });
      }

      const parsed = removeBodySchema.safeParse(raw);
      if (!parsed.success) {
        const flat = parsed.error.flatten();
        return jsonError("VALIDATION_ERROR", "Request body failed validation", {
          status: 400,
          requestId,
          details: { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors },
        });
      }
      const { documentType, pairs } = parsed.data;
      let result: { deleted: number };
      try {
        result = await removeDocumentRequirements(tx, { documentType, pairs });
      } catch (e) {
        const mapped = mapDocumentRequirementError(e, requestId);
        if (mapped) return mapped;
        throw e;
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.document_requirement.bulk_remove",
        entityType: "catalog_document_requirement",
        entityId: null,
        afterJson: JSON.stringify({
          documentType,
          nationalityCodes: [...new Set(pairs.map((p) => p.nationalityCode))],
          serviceIds: [...new Set(pairs.map((p) => p.serviceId))],
          pairCount: pairs.length,
          deleted: result.deleted,
        }),
      });
      return jsonOk(result, { requestId });
    },
  );
}
