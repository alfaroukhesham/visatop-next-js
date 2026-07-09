import type { Metadata } from "next";
import Script from "next/script";
import { Red_Hat_Display, Red_Hat_Mono, Red_Hat_Text } from "next/font/google";
import { AnalyticsProviders } from "@/components/analytics/analytics-providers";
import { GoogleTag } from "@/components/analytics/google-tag";
import { ThemeClassSync } from "@/components/theme-class-sync";
import { BFCACHE_BOOTSTRAP_SCRIPT } from "@/lib/client/bfcache-bootstrap-script";
import { getAppOrigin } from "@/lib/app-url";
import "./globals.css";

const bodySans = Red_Hat_Text({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const headingSans = Red_Hat_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
});

const mono = Red_Hat_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400"],
});

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bodySans.variable} ${headingSans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col">
        <Script
          id="visatop-bfcache-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: BFCACHE_BOOTSTRAP_SCRIPT }}
        />
        <GoogleTag />
        <AnalyticsProviders />
        <ThemeClassSync />
        {children}
      </body>
    </html>
  );
}
