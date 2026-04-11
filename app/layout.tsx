import type { Metadata } from "next";
import { Red_Hat_Display, Red_Hat_Mono, Red_Hat_Text } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
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
        <ThemeProvider>
          <div className="fixed top-4 right-4 z-50 flex justify-end">
            <ThemeToggle />
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
