import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { FC, ReactNode } from "react";
import { ClientAppHeader } from "@/components/client/client-app-header";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("seo.applyLayoutTitle"),
    description: t("seo.applyLayoutDescription"),
  };
};

interface IApplyLayoutProps {
  children: ReactNode;
}

const ApplyLayout: FC<IApplyLayoutProps> = ({ children }) => {
  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientAppHeader />
      <div className="relative flex-1">
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-3 py-10 sm:px-4 sm:py-12">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ApplyLayout;
