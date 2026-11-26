import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { ThemeClassSync } from "@/components/theme-class-sync";
import { BFCACHE_BOOTSTRAP_SCRIPT } from "@/lib/client/bfcache-bootstrap-script";
import { getAppOrigin } from "@/lib/app-url";
import { readCriticalFontPreloadHrefs } from "@/lib/client/critical-font-preloads";
import {
  CUSTOMER_LOCALE_COOKIE,
  CUSTOMER_LOCALE_REQUEST_HEADER,
  isCustomerLocaleRtl,
  resolveCustomerLocale,
} from "@/lib/i18n/customer-locale";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(`${getAppOrigin()}/`),
  title: {
    default: "Visatop",
    template: "%s · Visatop",
  },
  description:
    "Visa and residency services — manage your application, documents, and status in one place.",
  icons: {
    icon: [
      {
        url: "/visa-processing/favicon_visatop_com_32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    shortcut: ["/visa-processing/favicon_visatop_com_32x32.png"],
  },
};

const RootLayout = async ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const path = requestHeaders.get("x-pathname") ?? "";
  const locale = path.startsWith("/admin")
    ? "en"
    : resolveCustomerLocale({
        headerValue: requestHeaders.get(CUSTOMER_LOCALE_REQUEST_HEADER),
        cookieValue: cookieStore.get(CUSTOMER_LOCALE_COOKIE)?.value ?? null,
      });

  return (
    <html
      lang={locale}
      dir={isCustomerLocaleRtl(locale) ? "rtl" : "ltr"}
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="relative flex min-h-full flex-col">
        {readCriticalFontPreloadHrefs().map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        <Script
          id="visatop-bfcache-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: BFCACHE_BOOTSTRAP_SCRIPT }}
        />
        <ThemeClassSync />
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
