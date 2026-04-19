import { z } from "zod";

export const OCR_SCHEMA_VERSION = 1 as const;

/**
 * Parsed OCR output shape (spec §8.1). All fields are nullable; route-level
 * logic decides which are "required" for extraction success vs review.
 *
 * Date fields must match `YYYY-MM-DD` after normalization. The adapter accepts
 * a handful of common free-form variants and coerces them, otherwise leaves
 * null (logged as a schema error, not a crash).
 */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const ocrResultSchema = z
  .object({
    schemaVersion: z.literal(OCR_SCHEMA_VERSION).default(OCR_SCHEMA_VERSION),
    fullName: z.string().trim().min(1).max(200).nullable().optional(),
    dateOfBirth: z.string().regex(ISO_DATE_RE).nullable().optional(),
    placeOfBirth: z.string().trim().min(1).max(200).nullable().optional(),
    nationality: z.string().trim().min(1).max(120).nullable().optional(),
    passportNumber: z.string().trim().min(1).max(64).nullable().optional(),
    passportExpiryDate: z.string().regex(ISO_DATE_RE).nullable().optional(),
    profession: z.string().trim().min(1).max(200).nullable().optional(),
    address: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .strict();

export type OcrResult = z.infer<typeof ocrResultSchema>;

/** Required OCR fields for "succeeded" status (spec §6.1). */
export const REQUIRED_OCR_FIELDS = [
  "fullName",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
] as const;

export type RequiredOcrField = (typeof REQUIRED_OCR_FIELDS)[number];

export function listMissingOcrFields(result: OcrResult | null): RequiredOcrField[] {
  if (!result) return [...REQUIRED_OCR_FIELDS];
  return REQUIRED_OCR_FIELDS.filter((k) => {
    const v = (result as Record<string, unknown>)[k];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  });
}

/**
 * Hard cap on the raw string that comes back from the model before we attempt
 * JSON parsing. Shields against pathological large outputs that would cost
 * memory / blow JSON.parse budget.
 */
export const OCR_RAW_STRING_MAX = 8_192;
