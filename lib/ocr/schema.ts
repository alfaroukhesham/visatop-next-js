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
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const optionalMrzLine = z
  .string()
  .nullable()
  .optional()
  .transform((v) => {
    if (typeof v !== "string") return null;
    const line = v.replace(/\s+/g, "").toUpperCase();
    return line.length === 44 ? line : null;
  });

export const ocrResultSchema = z.strictObject({
  schemaVersion: z.literal(OCR_SCHEMA_VERSION).default(OCR_SCHEMA_VERSION),
  fullName: z.string().trim().min(1).max(200).nullable().optional(),
  dateOfBirth: z.string().regex(ISO_DATE_RE).nullable().optional(),
  placeOfBirth: z.string().trim().min(1).max(200).nullable().optional(),
  nationality: z.string().trim().min(1).max(120).nullable().optional(),
  passportNumber: z.string().trim().min(1).max(64).nullable().optional(),
  passportExpiryDate: z.string().regex(ISO_DATE_RE).nullable().optional(),
  profession: z.string().trim().min(1).max(200).nullable().optional(),
  address: z.string().trim().min(1).max(500).nullable().optional(),
  mrzLine1: optionalMrzLine,
  mrzLine2: optionalMrzLine,
});

export type OcrResult = z.infer<typeof ocrResultSchema>;

/** Required OCR fields for "succeeded" status (spec §6.1). */
const REQUIRED_OCR_FIELDS = [
  "fullName",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
] as const;

export type RequiredOcrField = (typeof REQUIRED_OCR_FIELDS)[number];

const isEmptyOcrValue = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

export function listMissingOcrFields(result: OcrResult | null): RequiredOcrField[] {
  if (!result) return [...REQUIRED_OCR_FIELDS];
  return REQUIRED_OCR_FIELDS.filter((k) => isEmptyOcrValue((result as Record<string, unknown>)[k]));
}

export const OCR_FILLABLE_FIELDS = [
  "fullName",
  "dateOfBirth",
  "placeOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiryDate",
  "profession",
  "address",
] as const;

export type TOcrFillableField = (typeof OCR_FILLABLE_FIELDS)[number];

/** Every non-empty reader field — used to highlight OCR fills for review. */
export function listFilledOcrFields(result: OcrResult | null): TOcrFillableField[] {
  if (!result) return [];
  return OCR_FILLABLE_FIELDS.filter((k) => !isEmptyOcrValue((result as Record<string, unknown>)[k]));
}

/**
 * Hard cap on the raw string that comes back from the model before we attempt
 * JSON parsing. Shields against pathological large outputs that would cost
 * memory / blow JSON.parse budget.
 */
export const OCR_RAW_STRING_MAX = 8_192;
