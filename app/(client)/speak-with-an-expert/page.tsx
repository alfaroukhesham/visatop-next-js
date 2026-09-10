import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ClientAppHeader } from "@/components/client/client-app-header";
import { ClientHeroPanel } from "@/components/client/client-surface";
import { WhatsAppExpertCtaButton } from "@/components/client/whatsapp-expert-cta-button";
import { CUSTOMER_LOCALE_COOKIE, parseCustomerLocale } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_LP_URL } from "@/lib/support-contact";
import { cn } from "@/lib/utils";

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));
  return {
    title: t("expert.pageTitle"),
    description: t("expert.pageDescription"),
    robots: { index: false, follow: true },
  };
};

const SpeakWithAnExpertPage = async () => {
  const cookieStore = await cookies();
  const t = createCustomerT(parseCustomerLocale(cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value));

  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientAppHeader />

      <div className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(40vh,420px)] bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(252,205,100,0.18),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 py-10 sm:px-4 md:py-14">
          <ClientHeroPanel
            className={cn(
              "theme-client-rise border-secondary/40 from-card via-card to-muted/60 mx-auto max-w-2xl border-[3px] p-8 shadow-[0_28px_72px_rgba(1,32,49,0.14)] md:p-12",
            )}
          >
            <section aria-labelledby="expert-headline">
              <p className="text-secondary text-center text-[11px] font-bold uppercase tracking-[0.28em]">
                {t("expert.eyebrow")}
              </p>
              <h1
                id="expert-headline"
                className="font-heading text-foreground mt-6 text-center text-[2rem] leading-[1.2] font-semibold md:text-[2.25rem]"
              >
                {t("expert.headline")}
              </h1>
              <p className="text-muted-foreground mt-6 text-center text-base leading-relaxed md:text-lg">
                {t("expert.body")}
              </p>

              <div className="mt-8">
                <WhatsAppExpertCtaButton href={SUPPORT_WHATSAPP_LP_URL} />
              </div>

              <p className="text-muted-foreground mt-4 text-center text-sm">
                {t("expert.replyTime", { phone: SUPPORT_PHONE_DISPLAY })}
              </p>
            </section>

            <section
              id="privacy-policy"
              aria-labelledby="privacy-heading"
              className="border-secondary/20 mt-10 border-t pt-8"
            >
              <h2 id="privacy-heading" className="font-heading text-foreground text-lg font-semibold">
                {t("expert.privacyTitle")}
              </h2>
              <div className="text-muted-foreground mt-3 space-y-3 text-sm leading-relaxed">
                <p>{t("expert.privacyParagraph1")}</p>
                <p>{t("expert.privacyParagraph2")}</p>
                <p>{t("expert.privacyParagraph3", { phone: SUPPORT_PHONE_DISPLAY })}</p>
                <p className="text-xs">{t("expert.privacyUpdated")}</p>
              </div>
            </section>
          </ClientHeroPanel>
        </div>
      </div>
    </div>
  );
};

export default SpeakWithAnExpertPage;
