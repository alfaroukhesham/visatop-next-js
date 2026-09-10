import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SignInForm } from "./sign-in-form";
import { isFacebookOAuthConfigured } from "@/lib/social-oauth";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("auth.signIn.pageTitle"),
    description: t("auth.signIn.pageDescription"),
    robots: { index: false, follow: true },
  };
};

const SignInPage = () => {
  return <SignInForm facebookEnabled={isFacebookOAuthConfigured()} />;
};

export default SignInPage;
