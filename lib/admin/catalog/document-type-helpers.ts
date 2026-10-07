export const DOCUMENT_TYPE_KEY_RE = /^[a-z][a-z0-9_]{1,62}$/;

export const DEFAULT_DOCUMENT_ACCEPT_MIME = "image/jpeg,image/png,application/pdf";

export const RESERVED_DOCUMENT_TYPE_KEYS = [
  "passport_copy",
  "personal_photo",
  "supporting",
  "admin_step_attachment",
  "outcome_approval",
  "outcome_authority_rejection",
] as const;

export type TCatalogDocumentType = {
  key: string;
  label: string;
  description: string;
  acceptMime: string;
  pairCount: number;
};

export const isReservedDocumentTypeKey = (key: string): boolean =>
  (RESERVED_DOCUMENT_TYPE_KEYS as readonly string[]).includes(key);

export const slugifyDocumentTypeLabel = (label: string): string =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 63);

export const humanizeDocumentTypeKey = (key: string): string => {
  const text = key.replace(/_/g, " ").trim();
  if (!text) return key;
  return text.charAt(0).toUpperCase() + text.slice(1);
};
