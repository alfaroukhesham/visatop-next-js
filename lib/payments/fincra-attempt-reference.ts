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

export const fincraWebhookLookupIds = (params: {
  merchantReference?: string | null;
  paymentIdFromMetadata?: string | null;
}): string[] => {
  const ids = new Set<string>();
  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) ids.add(trimmed);
  };
  add(params.merchantReference);
  add(params.paymentIdFromMetadata);
  const parsed = parseFincraAttemptReference(params.merchantReference);
  if (parsed) add(parsed.paymentId);
  return [...ids];
};
