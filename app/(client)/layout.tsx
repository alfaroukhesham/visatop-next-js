import { Inter, Noto_Serif } from "next/font/google";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { AnalyticsProviders } from "@/components/analytics/analytics-providers";
import { GoogleTag } from "@/components/analytics/google-tag";
import { ClientAuthStoreSync } from "@/components/client/client-auth-store-sync";
import { BfcacheRestoreSync } from "@/components/client/bfcache-restore-sync";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { StickyWhatsAppButton } from "@/components/client/sticky-whatsapp-button";
import { WpShellFallbackFooter, WpShellFallbackHeader } from "@/components/client/wp-shell/wp-shell-fallback";
import { WpShellFrame } from "@/components/client/wp-shell/wp-shell-frame";
import { getAppOrigin } from "@/lib/app-url";
import {
  CUSTOMER_LOCALE_COOKIE,
  CUSTOMER_LOCALE_REQUEST_HEADER,
  isCustomerLocaleRtl,
  resolveCustomerLocale,
} from "@/lib/i18n/customer-locale";
import { formatCustomerMessage, type TCustomerMessageVars } from "@/lib/i18n/customer-messages";
import { getCustomerI18nBundle } from "@/lib/i18n/load-customer-catalog";
import { fetchPolylangLanguages } from "@/lib/i18n/fetch-polylang-languages";
import { fetchWpShellModel } from "@/lib/wp-headless/fetch-layout";
import type { WpShellLanguageOption } from "@/lib/wp-headless/types";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const notoSerif = Noto_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600"],
});

const resolveLanguageSwitcherOptions = (input: {
  locale: string;
  polylang: Awaited<ReturnType<typeof fetchPolylangLanguages>>;
  layoutLanguage: { current: string; available: WpShellLanguageOption[] } | null;
}): { current: string; available: WpShellLanguageOption[] } => {
  if (input.layoutLanguage && input.layoutLanguage.available.length > 0) {
    return {
      current: input.locale,
      available: input.layoutLanguage.available.map((item) => ({
        ...item,
        isCurrent: item.slug === input.locale,
      })),
    };
  }
  return {
    current: input.locale,
    available: input.polylang.map((item) => ({
      slug: item.slug,
      name: item.name,
      isRtl: item.isRtl,
      isCurrent: item.slug === input.locale,
    })),
  };
};

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const wpOrigin = process.env.WP_ORIGIN ?? "";
  const disableWpLangSwitcher =
    process.env.DISABLE_WP_LANG_SWITCHER === "true" ||
    process.env.DISABLE_WP_LANG_SWITCHER === "1";

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const polylang = wpOrigin.trim().length > 0 ? await fetchPolylangLanguages({ wpOrigin }) : [];
  const knownSlugs = polylang.map((item) => item.slug);
  const locale = resolveCustomerLocale({
    headerValue: requestHeaders.get(CUSTOMER_LOCALE_REQUEST_HEADER),
    cookieValue: cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value ?? null,
    knownSlugs: knownSlugs.length > 0 ? knownSlugs : undefined,
  });

  const model =
    wpOrigin.trim().length > 0
      ? await fetchWpShellModel({
          wpOrigin,
          appOrigin: getAppOrigin(),
          appBasePath: "/visa-processing",
          lang: locale,
          revalidateSeconds: 60,
          includeHtml: true,
        })
      : null;

  const languageSwitcher =
    polylang.length > 0
      ? resolveLanguageSwitcherOptions({
          locale,
          polylang,
          layoutLanguage: model?.language ?? null,
        })
      : null;
  const hideNativeWpLangSwitcher = disableWpLangSwitcher || languageSwitcher !== null;
  const i18n = getCustomerI18nBundle(locale);
  const t = (key: string, vars?: TCustomerMessageVars) =>
    formatCustomerMessage(i18n.messages, i18n.fallback, key, vars);

  return (
    <div
      data-ui="client"
      dir={isCustomerLocaleRtl(locale) ? "rtl" : undefined}
      className={`theme-client theme-client-page-canvas ${inter.variable} ${notoSerif.variable} flex min-h-screen min-h-dvh flex-col text-[18px] leading-[1.6] antialiased`}
    >
      {model?.headerHtml ? (
        <WpShellFrame
          kind="header"
          html={model.headerHtml}
          cssUrls={model.cssUrls}
          baseHref={wpOrigin}
          hideLangSwitcher={hideNativeWpLangSwitcher}
          languageSwitcher={languageSwitcher ?? undefined}
        />
      ) : (
        <WpShellFallbackHeader t={t} />
      )}

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          paddingTop: "var(--wp-shell-header-height, 0px)",
          position: "relative",
          zIndex: 0,
        }}
      >
        <GoogleTag />
        <AnalyticsProviders />
        <BfcacheRestoreSync />
        <ClientAuthStoreSync />
        <CustomerI18nProvider locale={i18n.locale} messages={i18n.messages} fallback={i18n.fallback}>
          {children}
        </CustomerI18nProvider>
      </div>

      {model?.footerHtml ? (
        <WpShellFrame
          kind="footer"
          html={model.footerHtml}
          cssUrls={model.cssUrls}
          baseHref={wpOrigin}
          hideLangSwitcher={hideNativeWpLangSwitcher}
        />
      ) : (
        <WpShellFallbackFooter t={t} />
      )}

      <StickyWhatsAppButton label={t("common.whatsappSupport")} />
    </div>
  );
}
