import type { Metadata } from "next";
import { Red_Hat_Display, Red_Hat_Mono, Red_Hat_Text } from "next/font/google";
import { BfcacheRestoreSync } from "@/components/client/bfcache-restore-sync";
import { AdminAuthStoreSync } from "@/components/admin/admin-auth-store-sync";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const bodySans = Red_Hat_Text({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

const headingSans = Red_Hat_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

const mono = Red_Hat_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${bodySans.variable} ${headingSans.variable} ${mono.variable} min-h-full`}>
      <ThemeProvider>
        <BfcacheRestoreSync />
        <AdminAuthStoreSync />
        <div className="fixed top-4 right-4 z-50 flex justify-end">
          <ThemeToggle />
        </div>
        {children}
      </ThemeProvider>
    </div>
  );
}
