import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ApplyTwoColumn } from "@/components/apply/apply-two-column";
import { ResumeDraftModal } from "@/components/apply/resume-draft-modal";
import { ClientAppHeader } from "@/components/client/client-app-header";
import { ClientHeroPanel } from "@/components/client/client-surface";
import { HomeNationalityStart } from "@/components/client/home-nationality-start";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { appHref } from "@/lib/app-href";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import { getHomeServiceFacts } from "@/lib/seo/home-page-facts";
import { buildHomePageJsonLd } from "@/lib/seo/home-page-json-ld";
import { cn } from "@/lib/utils";

const readHomeLocale = async (): Promise<string> => {
  const cookieStore = await cookies();
  return parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value);
};

export const generateMetadata = async (): Promise<Metadata> => {
  const t = createCustomerT(await readHomeLocale());
  const description = t("seo.homeDescription");
  return {
    title: t("seo.homeTitle"),
    description,
    alternates: {
      canonical: appHref("/"),
    },
    openGraph: {
      title: t("seo.homeOgTitle"),
      description,
      url: appHref("/"),
      type: "website",
    },
  };
};

const Home = async () => {
  const locale = await readHomeLocale();
  const t = createCustomerT(locale);
  const facts = getHomeServiceFacts(locale);

  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ResumeDraftModal />
      <JsonLdScript id="visatop-home-jsonld" data={buildHomePageJsonLd({ locale })} />
      <ClientAppHeader />

      <div className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(52vh,520px)] bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(252,205,100,0.22),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 pb-16 pt-10 sm:px-4 md:pb-24 md:pt-14">
          <ApplyTwoColumn currentStep={1} contentClassName="min-w-0 space-y-12 md:space-y-16">
            <ClientHeroPanel
              className={cn(
                "theme-client-rise border-secondary/40 from-card via-card to-muted/60 relative border-[3px] p-8 shadow-[0_28px_72px_rgba(1,32,49,0.16)] md:p-12 lg:p-14",
              )}
            >
              <p className="text-secondary text-[11px] text-center font-bold uppercase tracking-[0.28em]">
                {t("home.eyebrow")}
              </p>
              <h1 className="font-heading text-foreground mt-6 text-center text-[2.25rem]! leading-[1.2]! font-semibold md:text-[2.25rem]!">
                <span className="block">{t("home.headlineLine1")} </span>
                <span className="text-secondary mt-3 block font-semibold leading-snug tracking-tight text-center">
                  {t("home.headlineLine2")}
                </span>
              </h1>
              <h2 className="font-heading text-foreground mt-6 text-center text-[1.25rem]! leading-[1.35]! font-semibold">
                {t("home.subheadline")}
              </h2>
              <p className="text-muted-foreground mt-7  text-base text-center leading-relaxed md:text-lg">
                {t("home.body")}
              </p>

              <HomeNationalityStart />
            </ClientHeroPanel>
          </ApplyTwoColumn>
        </div>
      </div>

      {/* Crawler-only facts for JSON-LD speakable + AI indexing — not shown to users. */}
      <ul
        id="service-facts"
        aria-hidden="true"
        className="pointer-events-none absolute size-0 overflow-hidden opacity-0"
      >
        {facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    </div>
  );
};

export default Home;
