export function formatOutcomeDocType(docType: string | null) {
  switch (docType) {
    case "outcome_approval":
      return "Approval / visa pack";
    case "outcome_authority_rejection":
      return "UAE authority rejection proof";
    default:
      return docType ?? "Unknown";
  }
}

export function formatBytes(n: number | null) {
  if (n == null || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
