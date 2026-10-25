/** First time paymentStatus becomes paid. Never overwrites an existing stamp. */
export const paidAtForFirstPaidTransition = (
  existingPaidAt: Date | null | undefined,
  now = new Date(),
): Date => existingPaidAt ?? now;

/** First time ops marks the visa completed. Rejections/cancels do not count as fulfilled. */
export const fulfilledAtForCompletedTransition = (
  toApplicationStatus: string,
  existingFulfilledAt: Date | null | undefined,
  now = new Date(),
): Date | undefined => {
  if (toApplicationStatus !== "completed") return undefined;
  return existingFulfilledAt ?? now;
};
