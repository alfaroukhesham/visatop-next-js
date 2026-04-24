import { Inter, Noto_Serif } from "next/font/google";
import type { ReactNode } from "react";
import { ClientShellFooter } from "@/components/client/client-shell-footer";

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

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-ui="client"
      className={`theme-client theme-client-page-canvas ${inter.variable} ${notoSerif.variable} flex min-h-dvh flex-col text-[18px] leading-[1.6] antialiased`}
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <ClientShellFooter />
    </div>
  );
}
