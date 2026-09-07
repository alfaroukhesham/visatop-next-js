"use client";

import { createContext, useContext, type FC, type ReactNode } from "react";
import {
  formatCustomerMessage,
  type TCustomerMessageVars,
  type TCustomerMessages,
} from "@/lib/i18n/customer-messages";

interface ICustomerI18nValue {
  locale: string;
  t: (key: string, vars?: TCustomerMessageVars) => string;
}

const CustomerI18nContext = createContext<ICustomerI18nValue | null>(null);

interface ICustomerI18nProviderProps {
  locale: string;
  messages: TCustomerMessages;
  fallback: TCustomerMessages;
  children: ReactNode;
}

export const CustomerI18nProvider: FC<ICustomerI18nProviderProps> = ({
  locale,
  messages,
  fallback,
  children,
}) => {
  const t = (key: string, vars?: TCustomerMessageVars) =>
    formatCustomerMessage(messages, fallback, key, vars);

  return (
    <CustomerI18nContext.Provider value={{ locale, t }}>{children}</CustomerI18nContext.Provider>
  );
};

export const useCustomerT = (): ICustomerI18nValue["t"] => {
  const ctx = useContext(CustomerI18nContext);
  if (!ctx) {
    throw new Error("useCustomerT must be used within CustomerI18nProvider");
  }
  return ctx.t;
};

export const useCustomerLocale = (): string => {
  const ctx = useContext(CustomerI18nContext);
  if (!ctx) {
    throw new Error("useCustomerLocale must be used within CustomerI18nProvider");
  }
  return ctx.locale;
};
