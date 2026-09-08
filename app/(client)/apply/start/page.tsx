import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { StartApplicationForm } from "@/components/apply/start-application-form";
import { ClientSurface } from "@/components/client/client-surface";
import { nationalityDisplayName } from "@/lib/apply/display-names";
import { listPublicNationalities } from "@/lib/catalog/queries";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("start.pageTitle"),
  };
};

const normalizeNationalityParam = (value: string | string[] | undefined): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return undefined;
  const code = raw.trim().toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return undefined;
  return code;
};

interface IApplyStartPageProps {
  searchParams?: Promise<{ nationality?: string | string[] }>;
}

const ApplyStartPage = async ({ searchParams }: IApplyStartPageProps) => {
  const sp = searchParams ? await searchParams : {};
  const initialNationalityCode = normalizeNationalityParam(sp.nationality);
  if (!initialNationalityCode) {
    redirect("/");
  }

  const nationalities = await withSystemDbActor((tx) => listPublicNationalities(tx));
  const nationalityName = nationalityDisplayName(initialNationalityCode, nationalities);

  return (
    <div className="max-w-6xl pb-8">
      <ApplyTwoColumn currentStep={2} contentClassName="space-y-6">
        <ClientSurface
          preset="highlight"
          className="border-secondary/40 bg-card/95 p-6 shadow-[0_18px_56px_rgba(1,32,49,0.12)] sm:p-8 md:p-10"
        >
          <StartApplicationForm
            key={initialNationalityCode}
            initialNationalityCode={initialNationalityCode}
            nationalityName={nationalityName}
          />
        </ClientSurface>
      </ApplyTwoColumn>
    </div>
  );
};

export default ApplyStartPage;
