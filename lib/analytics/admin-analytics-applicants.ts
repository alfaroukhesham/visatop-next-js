import { ADMIN_FUNNEL_STEPS } from "@/lib/analytics/funnel-metrics";
import { minorUnitsToMajor } from "@/lib/pricing/format-minor-units";
import type { TApplicantExportRow } from "@/lib/analytics/admin-analytics-types";

export const ADMIN_FUNNEL_STEP_EVENT_NAMES = ADMIN_FUNNEL_STEPS.map((step) => step.eventName);

export type TApplicantPaymentIndexRow = {
  applicationId: string;
  partyId: string | null;
  amountMinor: bigint;
  currency: string;
};

type TAmountCurrency = { amountMinor: bigint; currency: string };

export type TApplicantPaymentIndex = {
  byApplicationId: Map<string, TAmountCurrency[]>;
  byPartyId: Map<string, TAmountCurrency[]>;
};

/**
 * Linear ADMIN_FUNNEL_STEPS only. Extra branches (OCR, apply_step_view, guest-link)
 * do not fill last_step — historical apps with no linear events stay N/A.
 */
export const lastApplicantStepLabel = (eventNames: string[]): string => {
  let furthest = -1;
  for (const name of eventNames) {
    const idx = ADMIN_FUNNEL_STEPS.findIndex((step) => step.eventName === name);
    if (idx > furthest) furthest = idx;
  }
  if (furthest < 0) return "N/A";
  return ADMIN_FUNNEL_STEPS[furthest]!.label;
};

export const applicantAmountPaidCell = (input: {
  isPaid: boolean;
  amountMinor: bigint | number | string;
  currency: string;
}): string => {
  const currency = input.currency.trim().toUpperCase() || "USD";
  if (!input.isPaid) return `0.00 ${currency}`;
  const minor =
    typeof input.amountMinor === "bigint" ? input.amountMinor : BigInt(input.amountMinor);
  return `${minorUnitsToMajor(minor).toFixed(2)} ${currency}`;
};

export const applicantEmail = (input: {
  guestEmail: string | null;
  userEmail: string | null;
  partyGuestEmail: string | null;
}): string => {
  for (const candidate of [input.guestEmail, input.userEmail, input.partyGuestEmail]) {
    const value = candidate?.trim() ?? "";
    if (value) return value;
  }
  return "";
};

export const indexApplicantPayments = (
  payments: TApplicantPaymentIndexRow[],
): TApplicantPaymentIndex => {
  const byApplicationId = new Map<string, TAmountCurrency[]>();
  const byPartyId = new Map<string, TAmountCurrency[]>();
  for (const paymentRow of payments) {
    const amount = { amountMinor: paymentRow.amountMinor, currency: paymentRow.currency };
    const appRows = byApplicationId.get(paymentRow.applicationId) ?? [];
    appRows.push(amount);
    byApplicationId.set(paymentRow.applicationId, appRows);
    if (paymentRow.partyId) {
      const partyRows = byPartyId.get(paymentRow.partyId) ?? [];
      partyRows.push(amount);
      byPartyId.set(paymentRow.partyId, partyRows);
    }
  }
  return { byApplicationId, byPartyId };
};

const paymentRowsForApplicant = (input: {
  applicationId: string;
  partyId: string | null;
  indexed: TApplicantPaymentIndex;
}): TAmountCurrency[] =>
  input.partyId
    ? (input.indexed.byPartyId.get(input.partyId) ?? [])
    : (input.indexed.byApplicationId.get(input.applicationId) ?? []);

export const applicantPaidAmountMinor = (input: {
  isPaid: boolean;
  applicationId: string;
  partyId: string | null;
  indexed: TApplicantPaymentIndex;
}): bigint => {
  if (!input.isPaid) return BigInt(0);
  return paymentRowsForApplicant(input).reduce(
    (sum, row) => sum + row.amountMinor,
    BigInt(0),
  );
};

export const applicantPaidCurrency = (input: {
  isPaid: boolean;
  catalogCurrency: string;
  applicationId: string;
  partyId: string | null;
  indexed: TApplicantPaymentIndex;
}): string => {
  if (!input.isPaid) return input.catalogCurrency;
  return paymentRowsForApplicant(input)[0]?.currency ?? input.catalogCurrency;
};

export const toApplicantExportRow = (input: {
  email: string;
  createdAt: Date;
  isPaid: boolean;
  amountMinor: bigint;
  currency: string;
  visaType: string;
  eventNames: string[];
}): TApplicantExportRow => ({
  email: input.email,
  createdAt: input.createdAt.toISOString(),
  paid: input.isPaid ? "yes" : "no",
  amountPaid: applicantAmountPaidCell({
    isPaid: input.isPaid,
    amountMinor: input.amountMinor,
    currency: input.currency,
  }),
  visaType: input.visaType,
  lastStep: lastApplicantStepLabel(input.eventNames),
});
