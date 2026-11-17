const ATTEMPT_PATTERN = /^(.+)-a(\d+)$/;

export const fincraAttemptReference = (paymentId: string, attempt: number): string =>
  `${paymentId}-a${attempt}`;

export const parseFincraAttemptReference = (
  reference: string | null | undefined,
): { paymentId: string; attempt: number } | null => {
  const raw = reference?.trim() ?? "";
  if (!raw) return null;
  const match = ATTEMPT_PATTERN.exec(raw);
  if (!match) return null;
  const paymentId = match[1]?.trim() ?? "";
  const attempt = Number(match[2]);
  if (!paymentId || !Number.isInteger(attempt) || attempt < 1) return null;
  return { paymentId, attempt };
};

export const nextFincraAttemptReference = (
  paymentId: string,
  currentReference?: string | null,
): string => {
  const parsed = parseFincraAttemptReference(currentReference);
  if (parsed && parsed.paymentId === paymentId) {
    return fincraAttemptReference(paymentId, parsed.attempt + 1);
  }
  return fincraAttemptReference(paymentId, 1);
};

export const fincraAttemptNumberForReference = (
  paymentId: string,
  reference: string | null | undefined,
): number => {
  const parsed = parseFincraAttemptReference(reference);
  if (parsed && parsed.paymentId === paymentId) return parsed.attempt;
  return 1;
};

/** Our checkout ref from Fincra webhook `data` fields (portal puts it on `reference`, not `merchantReference`). */
export const resolveFincraWebhookMerchantReference = (params: {
  merchantReference?: string | null;
  reference?: string | null;
  chargeReference?: string | null;
  metadataReference?: string | null;
}): string | null => {
  const direct = params.merchantReference?.trim();
  if (direct) return direct;
  const fromAttemptPattern = (value?: string | null): string | null => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return parseFincraAttemptReference(trimmed) ? trimmed : null;
  };
  return (
    fromAttemptPattern(params.reference) ??
    fromAttemptPattern(params.chargeReference) ??
    fromAttemptPattern(params.metadataReference) ??
    null
  );
};

export const fincraWebhookLookupIds = (params: {
  merchantReference?: string | null;
  paymentIdFromMetadata?: string | null;
  reference?: string | null;
  chargeReference?: string | null;
  metadataReference?: string | null;
}): string[] => {
  const ids = new Set<string>();
  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) ids.add(trimmed);
  };
  const merchantReference =
    params.merchantReference?.trim() ||
    resolveFincraWebhookMerchantReference({
      reference: params.reference,
      chargeReference: params.chargeReference,
      metadataReference: params.metadataReference,
    });
  add(merchantReference);
  add(params.paymentIdFromMetadata);
  const parsed = parseFincraAttemptReference(merchantReference);
  if (parsed) add(parsed.paymentId);
  return [...ids];
};
