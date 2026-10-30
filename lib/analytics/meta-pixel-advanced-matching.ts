import type { TMetaAdvancedMatchingUser } from "@/lib/analytics/meta-pixel-client";

const digitsOnly = (raw: string): string => raw.replace(/\D/g, "");

/**
 * Browser advanced matching for WebisteVisa. Plain values only — never hash here,
 * never include passport / document fields.
 */
export const buildMetaAdvancedMatchingUserData = (input: {
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
}): TMetaAdvancedMatchingUser | null => {
  const em = input.email?.trim().toLowerCase() ?? "";
  const ph = digitsOnly(input.phone ?? "");
  const externalId = input.userId?.trim() ?? "";
  const data: TMetaAdvancedMatchingUser = {};
  if (em) data.em = em;
  if (ph) data.ph = ph;
  if (externalId) data.external_id = externalId;
  return Object.keys(data).length > 0 ? data : null;
};

type TPhoneListener = () => void;

let phoneDigits: string | null = null;
const phoneListeners = new Set<TPhoneListener>();

export const setMetaAdvancedMatchingPhone = (raw: string | null | undefined): void => {
  const next = digitsOnly(raw ?? "") || null;
  if (next === phoneDigits) return;
  phoneDigits = next;
  phoneListeners.forEach((listener) => listener());
};

export const subscribeMetaAdvancedMatchingPhone = (listener: TPhoneListener): (() => void) => {
  phoneListeners.add(listener);
  return () => {
    phoneListeners.delete(listener);
  };
};

export const getMetaAdvancedMatchingPhone = (): string | null => phoneDigits;

export const resetMetaAdvancedMatchingPhone = (): void => {
  phoneDigits = null;
};
