import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiHref } from "@/lib/app-href";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

const readResumeLocale = async (): Promise<string> => {
  const cookieStore = await cookies();
  return parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value);
};

export const generateMetadata = async (): Promise<Metadata> => {
  const t = createCustomerT(await readResumeLocale());
  return {
    title: t("resume.pageTitle"),
    robots: { index: false, follow: true },
  };
};

export const dynamic = "force-dynamic";

interface IApplyResumePageProps {
  searchParams: Promise<{ invalid?: string; t?: string }>;
}

const ApplyResumePage = async ({ searchParams }: IApplyResumePageProps) => {
  const params = await searchParams;
  const t = createCustomerT(await readResumeLocale());

  if (params.t?.trim() && !params.invalid) {
    const qs = new URLSearchParams({ t: params.t.trim() });
    redirect(apiHref(`apply/resume?${qs.toString()}`));
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
      <h1 className="font-heading text-center text-lg font-semibold">
        {t("resume.invalidLinkTitle")}
      </h1>
      <Link href="/apply/track" className="text-link text-center text-sm font-medium">
        {t("resume.invalidLinkCta")}
      </Link>
    </div>
  );
};

export default ApplyResumePage;
