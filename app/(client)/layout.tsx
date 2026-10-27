import { Noto_Serif, Red_Hat_Text } from "next/font/google";
import { cookies, headers } from "next/headers";
import type { CSSProperties, ReactNode } from "react";
import { preload } from "react-dom";
import { AnalyticsProviders } from "@/components/analytics/analytics-providers";
import { AnalyticsResourceHints } from "@/components/analytics/analytics-resource-hints";
import { MarketingTags } from "@/components/analytics/marketing-tags";
import { MicrosoftClarity } from "@/components/analytics/microsoft-clarity";
import { ClientAuthStoreSync } from "@/components/client/client-auth-store-sync";
import { BfcacheRestoreSync } from "@/components/client/bfcache-restore-sync";
import { CustomerI18nProvider } from "@/components/client/customer-i18n-provider";
import { StickyWhatsAppButton } from "@/components/client/sticky-whatsapp-button";
import { WpShellFallbackFooter, WpShellFallbackHeader } from "@/components/client/wp-shell/wp-shell-fallback";
import { WpShellFrame } from "@/components/client/wp-shell/wp-shell-frame";
import { getAppOrigin } from "@/lib/app-url";
import { readCriticalFontPreloadHrefs } from "@/lib/client/critical-font-preloads";
import {
  CUSTOMER_LOCALE_COOKIE,
  CUSTOMER_LOCALE_REQUEST_HEADER,
  isCustomerLocaleRtl,
  resolveCustomerLocale,
} from "@/lib/i18n/customer-locale";
import { formatCustomerMessage, type TCustomerMessageVars } from "@/lib/i18n/customer-messages";
import { getCustomerI18nBundle } from "@/lib/i18n/load-customer-catalog";
import { fetchPolylangLanguages } from "@/lib/i18n/fetch-polylang-languages";
import { areMarketingTagsEnabledFromHeaders } from "@/lib/analytics/marketing-tags-enabled";
import { fetchWpShellModel } from "@/lib/wp-headless/fetch-layout";
import type { WpShellLanguageOption } from "@/lib/wp-headless/types";

const redHatText = Red_Hat_Text({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  // CSS still swap-loads Red Hat so body matches prod. Do not preload it:
  // the extra woff2 contended with Noto on Slow 4G and recast LCP past 3s.
  preload: false,
  adjustFontFallback: true,
});

const notoSerif = Noto_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600"],
  // optional + preload: desktop still gets Noto; Slow 4G LCP stays on the
  // size-adjusted fallback instead of recasting the hero after the woff2.
  display: "optional",
  preload: true,
  adjustFontFallback: true,
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

  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
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
  const marketingTagsEnabled = areMarketingTagsEnabledFromHeaders(requestHeaders);
  const criticalFontHrefs = readCriticalFontPreloadHrefs();
  for (const href of criticalFontHrefs) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }

  return (
    <div
      data-ui="client"
      dir={isCustomerLocaleRtl(locale) ? "rtl" : undefined}
      className={`theme-client theme-client-page-canvas ${redHatText.variable} ${notoSerif.variable} flex min-h-screen min-h-dvh flex-col text-[18px] leading-[1.6] antialiased${model?.headerHtml ? " theme-client-wp-header" : ""}`}
      style={
        model?.headerHtml
          ? ({ ["--wp-shell-header-height"]: "118px" } as CSSProperties)
          : undefined
      }
    >
      {criticalFontHrefs.map((href) => (
        <link
          key={href}
          rel="preload"
          href={href}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      ))}
      <span className={`${redHatText.className} sr-only`} aria-hidden>
        {" "}
      </span>
      <span className={`${notoSerif.className} sr-only`} aria-hidden>
        {" "}
      </span>
      {model?.headerHtml ? (
        <style
          dangerouslySetInnerHTML={{
            __html:
              ".theme-client-wp-header{--wp-shell-header-height:118px}" +
              ".theme-client-wp-header .theme-client-main{padding-top:118px!important}" +
              ".theme-client-wp-header iframe[data-wp-shell=header]{min-height:118px;height:118px!important}",
          }}
        />
      ) : null}
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
        className="theme-client-main relative z-0 flex min-h-0 flex-1 flex-col"
        style={model?.headerHtml ? { paddingTop: 118 } : undefined}
      >
        <AnalyticsResourceHints includeMarketing={marketingTagsEnabled} />
        <MarketingTags />
        <MicrosoftClarity />
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

      {/*
        Shared client-shell render (home, apply, portal, auth, expert LP).
        Tourist visa flow steps no-op inside StickyWhatsAppButton (WA-AB-TEST 2026-10-26).
        Do not comment this out — that would also hide the button outside the tourist flow.
      */}
      <StickyWhatsAppButton label={t("common.whatsappSupport")} />
    </div>
  );
}
