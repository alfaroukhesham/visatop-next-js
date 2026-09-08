import ar from "@/messages/customer/ar.json";
import de from "@/messages/customer/de.json";
import en from "@/messages/customer/en.json";
import es from "@/messages/customer/es.json";
import fr from "@/messages/customer/fr.json";
import ha from "@/messages/customer/ha.json";
import hi from "@/messages/customer/hi.json";
import it from "@/messages/customer/it.json";
import ru from "@/messages/customer/ru.json";
import tl from "@/messages/customer/tl.json";
import tr from "@/messages/customer/tr.json";
import {
  FALLBACK_CUSTOMER_LOCALE_SLUGS,
  parseCustomerLocale,
  type TCustomerLocaleSlug,
} from "@/lib/i18n/customer-locale";
import {
  formatCustomerMessage,
  isCustomerMessageLocale,
  type TCustomerMessageVars,
  type TCustomerMessages,
} from "@/lib/i18n/customer-messages";

const CATALOGS: Record<TCustomerLocaleSlug, TCustomerMessages> = {
  ar: ar as TCustomerMessages,
  de: de as TCustomerMessages,
  en: en as TCustomerMessages,
  es: es as TCustomerMessages,
  fr: fr as TCustomerMessages,
  ha: ha as TCustomerMessages,
  hi: hi as TCustomerMessages,
  it: it as TCustomerMessages,
  ru: ru as TCustomerMessages,
  tl: tl as TCustomerMessages,
  tr: tr as TCustomerMessages,
};

export const CUSTOMER_CATALOG_LOCALES = FALLBACK_CUSTOMER_LOCALE_SLUGS;

export const getEnglishCustomerMessages = (): TCustomerMessages => CATALOGS.en;

export const getCustomerMessages = (locale: string): TCustomerMessages => {
  if (isCustomerMessageLocale(locale)) return CATALOGS[locale];
  return CATALOGS.en;
};

export const getCustomerI18nBundle = (locale: string) => {
  const resolved = parseCustomerLocale(locale);
  return {
    locale: resolved,
    messages: getCustomerMessages(resolved),
    fallback: CATALOGS.en,
  };
};

export const createCustomerT = (locale: string) => {
  const { messages, fallback } = getCustomerI18nBundle(locale);
  return (key: string, vars?: TCustomerMessageVars): string =>
    formatCustomerMessage(messages, fallback, key, vars);
};

export const customerInLanguageTag = (locale: string): string => {
  const resolved = parseCustomerLocale(locale);
  return resolved === "en" ? "en-GB" : resolved;
};
