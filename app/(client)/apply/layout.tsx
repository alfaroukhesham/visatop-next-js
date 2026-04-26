import type { Metadata } from "next";
import { ClientAppHeader } from "@/components/client/client-app-header";

export const metadata: Metadata = {
  title: "Apply | Visatop",
  description:
    "Choose your nationality and visa service to open your application—available for guests and signed-in customers.",
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientAppHeader />
      <div className="relative flex-1">
        <div className="relative mx-auto w-full max-w-[calc(1300px+3rem)] px-5 py-10 sm:px-8 sm:py-12">
          {children}
        </div>
      </div>
    </div>
  );
}
