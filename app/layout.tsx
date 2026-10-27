import type { Metadata } from "next";
import Script from "next/script";
import { ThemeClassSync } from "@/components/theme-class-sync";
import { BFCACHE_BOOTSTRAP_SCRIPT } from "@/lib/client/bfcache-bootstrap-script";
import { getAppOrigin } from "@/lib/app-url";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="relative flex min-h-full flex-col">
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
}
