import { formatIsoDateAsDdMmYyyy } from "@/lib/documents/validation-readiness";
import type {
  ApplicantProfile,
  ApplicantProfileFieldKey,
  DocType,
  ExtractResponse,
  PublicDocument,
} from "./types";

export function latestByType(docs: PublicDocument[], type: DocType) {
  return docs.find((d) => d.documentType === type && d.status !== "deleted") ?? null;
}

export function applicantFieldValue(
  applicant: ApplicantProfile,
  key: ApplicantProfileFieldKey,
  guestEmail: string | null,
): string {
  if (key === "email") return guestEmail ?? "";
  if (key === "dateOfBirth") return formatIsoDateAsDdMmYyyy(applicant.dateOfBirth ?? null);
  if (key === "passportExpiryDate") return formatIsoDateAsDdMmYyyy(applicant.passportExpiryDate ?? null);
  return applicant[key] ?? "";
}

/** Remount profile form when server-driven applicant / extraction data changes (avoids setState-in-effect). */
export function applicantFormResetKey(
  applicant: ApplicantProfile,
  extraction: ExtractResponse["extraction"] | null,
  guestEmail: string | null,
): string {
  const stable = [
    applicant.fullName ?? "",
    applicant.dateOfBirth ?? "",
    applicant.nationality ?? "",
    applicant.passportNumber ?? "",
    applicant.passportExpiryDate ?? "",
    applicant.placeOfBirth ?? "",
    applicant.profession ?? "",
    applicant.address ?? "",
    applicant.phone ?? "",
    guestEmail ?? "",
  ].join("\u001e");
  const ex = extraction
    ? `${extraction.documentId ?? ""}\u001e${extraction.attemptsUsed}\u001e${extraction.status}`
    : "";
  return `${stable}\u001e${ex}`;
}

/** Enforce DD-MM-YYYY mask: strip non-digits, cap at 8 digits, auto-insert dashes. */
export function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

export function customerFacingExtractionLabel(status: string | null | undefined): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "running":
      return "In progress";
    case "succeeded":
      return "Completed";
    case "needs_manual":
      return "Needs manual review";
    case "failed":
      return "Needs manual entry";
    default:
      return "Not started";
  }
}
