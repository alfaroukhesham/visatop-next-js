import type { TCustomerLocaleSlug } from "@/lib/i18n/customer-locale";
import { FALLBACK_CUSTOMER_LOCALE_SLUGS } from "@/lib/i18n/customer-locale";

export type TCustomerMessages = {
  [key: string]: string | TCustomerMessages;
};

export type TCustomerMessageVars = Record<string, string | number>;

export const lookupCustomerMessage = (tree: unknown, key: string): string | null => {
  if (!key.trim()) return null;
  let cur: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null || Array.isArray(cur) || !(part in cur)) {
      return null;
    }
    cur = (cur as TCustomerMessages)[part];
  }
  return typeof cur === "string" ? cur : null;
};

export const interpolateCustomerMessage = (
  template: string,
  vars?: TCustomerMessageVars,
): string => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
};

export const formatCustomerMessage = (
  messages: TCustomerMessages,
  fallback: TCustomerMessages,
  key: string,
  vars?: TCustomerMessageVars,
): string => {
  const raw = lookupCustomerMessage(messages, key) ?? lookupCustomerMessage(fallback, key) ?? key;
  return interpolateCustomerMessage(raw, vars);
};

export const isCustomerMessageLocale = (slug: string): slug is TCustomerLocaleSlug =>
  (FALLBACK_CUSTOMER_LOCALE_SLUGS as readonly string[]).includes(slug);
