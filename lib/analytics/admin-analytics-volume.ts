import { APPLY_FUNNEL_EVENTS } from "@/lib/analytics/apply-funnel";

export const uniquePaidApplicationCount = (
  events: Array<{ eventName: string; applicationId: string | null }>,
): number => {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.eventName !== APPLY_FUNNEL_EVENTS.paymentSucceeded) continue;
    if (!event.applicationId) continue;
    ids.add(event.applicationId);
  }
  return ids.size;
};

export type TPaidVolumeApplication = {
  id: string;
  partyId: string | null;
  paymentStatus: string;
};

/** Paid travellers attributed to checkout payment rows (works for history with no funnel events). */
export const paidApplicationIdsForCheckoutPayments = (
  applications: TPaidVolumeApplication[],
  paidPayments: Array<{ applicationId: string }>,
): string[] => {
  const partyById = new Map(applications.map((app) => [app.id, app.partyId]));
  const paidDirectIds = new Set<string>();
  const paidPartyIds = new Set<string>();
  for (const paymentRow of paidPayments) {
    paidDirectIds.add(paymentRow.applicationId);
    const partyId = partyById.get(paymentRow.applicationId);
    if (partyId) paidPartyIds.add(partyId);
  }
  return applications
    .filter((app) => app.paymentStatus === "paid")
    .filter(
      (app) => paidDirectIds.has(app.id) || (app.partyId !== null && paidPartyIds.has(app.partyId)),
    )
    .map((app) => app.id);
};

/** Paid KPI: application is paid, or payment_succeeded fired, without double-counting. */
export const paidKpiApplicationIds = (input: {
  checkoutPaidIds: string[];
  paymentSucceededApplicationIds: Array<string | null>;
}): string[] => {
  const ids = new Set(input.checkoutPaidIds);
  for (const id of input.paymentSucceededApplicationIds) {
    if (id) ids.add(id);
  }
  return [...ids];
};

/** Abandoned drafts: created in range and not paid (includes checkout_created). */
export const abandonedPaymentStatusSqlValue = (paymentStatus: string): boolean =>
  paymentStatus !== "paid";
