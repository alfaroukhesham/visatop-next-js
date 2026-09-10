import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthFlowSkeleton } from "@/components/auth/auth-flow-skeleton";
import { auth } from "@/lib/auth";
import { adminAuth } from "@/lib/admin-auth";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("auth.signUp.pageTitle"),
    description: t("auth.signUp.pageDescription"),
    robots: { index: false, follow: true },
  };
};

interface ISignUpLayoutProps {
  children: ReactNode;
}

const SignUpLayout = async ({ children }: ISignUpLayoutProps) => {
  const hdrs = await headers();
  const [clientSession, adminSession] = await Promise.all([
    auth.api.getSession({ headers: hdrs }),
    adminAuth.api.getSession({ headers: hdrs }),
  ]);

  if (adminSession) redirect("/admin");
  if (clientSession) redirect("/portal/track");

  return <Suspense fallback={<AuthFlowSkeleton />}>{children}</Suspense>;
};

export default SignUpLayout;
