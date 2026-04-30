import { Inter, Noto_Serif } from "next/font/google";
import type { ReactNode } from "react";
import { ClientAuthStoreSync } from "@/components/client/client-auth-store-sync";
import { WpShellFallbackFooter, WpShellFallbackHeader } from "@/components/client/wp-shell/wp-shell-fallback";
import { WpShellFrame } from "@/components/client/wp-shell/wp-shell-frame";
import { getAppOrigin } from "@/lib/app-url";
import { fetchWpShellModel } from "@/lib/wp-headless/fetch-layout";

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

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const wpOrigin = process.env.WP_ORIGIN ?? "";
  const model =
    wpOrigin.trim().length > 0
      ? await fetchWpShellModel({
          wpOrigin,
          appOrigin: getAppOrigin(),
          appBasePath: "/visa-processing",
          revalidateSeconds: 60,
        })
      : null;

  return (
    <div
      data-ui="client"
      className={`theme-client theme-client-page-canvas ${inter.variable} ${notoSerif.variable} flex min-h-dvh flex-col text-[18px] leading-[1.6] antialiased`}
    >
      {model?.headerHtml ? (
        <WpShellFrame kind="header" html={model.headerHtml} cssUrls={model.cssUrls} baseHref={wpOrigin} />
      ) : (
        <WpShellFallbackHeader />
      )}

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          paddingTop: "var(--wp-shell-header-height, 0px)",
          position: "relative",
          zIndex: 0,
        }}
      >
        <ClientAuthStoreSync />
        {children}
      </div>

      {model?.footerHtml ? (
        <WpShellFrame kind="footer" html={model.footerHtml} cssUrls={model.cssUrls} baseHref={wpOrigin} />
      ) : (
        <WpShellFallbackFooter />
      )}
    </div>
  );
}
