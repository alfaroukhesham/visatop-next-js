import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  FolderOpen,
  Globe,
  HelpCircle,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const destinations = [
  {
    title: "Schengen Area",
    description:
      "Access to 27 European countries for tourism and business purposes.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDxtQBjkq6DiiDmliMtFDWDd9R5OdTx-9MOZ-HjSOYPCsR9y9BxHkiVEbSDFks82y8uYePRglxNrkhkMzFDDWlJOSjkWwKQ9DCA_lo5UogDyEixaeEOliDwTQI2J5XgCgM8Gosve3MluO3Bt4CaBZJ5vXMrRST-BGzldkJydqtAr7LKuicqTQhPAnGdBk79SyHYMRHC28v7LF98poyBlcj3m9eMR8T5P9TvggQgHl7gxjyj2XQ9sS5eYkosvz7r5vgs2EX2csFQaE8",
  },
  {
    title: "Australia",
    description:
      "Electronic Travel Authority (ETA) for short-term tourism or business visitor activities.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAL7j3tRJT8C_AlX5wcD-UiDOdd2h_JXC3V78AO6oivOCdcY4l_6e9QpOIZ3RiQFhr0OOkq9BmRKft6oOUQUPTiBaLkwNlVbLit7yoU1KGpewyIixpxPtUolhVyoj1Rd-sh4XNCIX8yGuiddExlczwQESQpdibNncLdZxEh9qEmOha8efyzqdvVPLmzpMSUn4Xx1aMqmryLu-TjOLnIieT0DSHjwx25ujJajxu9qrl8Y9yNS3CMR5ouCf3RoIm2r_6dRBMzwjvhmng",
  },
  {
    title: "United Kingdom",
    description:
      "Standard Visitor visa for tourism, business, study, and other permitted activities.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBVAmBE23KOGZ2UZbob9p3lI5pgDymQZdfao3Na6YnvEvOQCLAtLJy3IGhJxJXDQj6KRJIBE_HLZ2o3KrDA8kCqUeYL-xZRRnQgEXJWxf57dlxHbYBLHzqiu4M-ArNeYFz9_npbxt2GnewJjYjXMuOF7RQ0ehu4Y91od9SsJDrgg2VmDupLeg8tPfWcJhQfWgQKNb2gY4m0VwZE51vcOg5gbDCAXL_uTScYTfrXvbqfeXraAgJV0Qef7VF69ok99pYMSljErZjRSvo",
  },
] as const;

export const metadata = {
  title: "Client dashboard | Unified Hybrid Portal",
};

export default function ClientDashboardPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="z-10 flex h-16 w-full shrink-0 items-center justify-between border-b border-white/10 bg-[#151515] px-6 text-white">
        <div className="flex items-center gap-4">
          <Globe className="size-6" aria-hidden />
          <h1 className="text-lg font-bold tracking-tight">
            Unified Hybrid Portal
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <ThemeToggle inverse className="rounded-full" />
          <div className="relative size-8 overflow-hidden rounded-full border border-white/20">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_fTV13qZ-Qk3C0IpUGXFBnMSR3w0m-_cpK-VjJSmJV_Jq3i7SZIH2bFPb4owekq6vUjdn4RpJp8rgQnmy-6V9KDdFDx0G8JoISOGgbyZPxS3f-GNcQEc254LkXhsVLG5ieG4zXqaEcmn0VBoV6MAXndCoDGe4FHYHH1CrFWQMVTvhypzwWqHqmE4PzsCVafqyc-UYRAzu58ON5vWWRYXql2mPVZ1E39Zf1BQO-7rkx9X_U-Ydif3hnv7m_iEP9sO_6sbTOokTvpY"
              alt=""
              fill
              className="object-cover"
              sizes="32px"
            />
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 overflow-hidden">
        <aside className="hidden w-[250px] shrink-0 flex-col border-r border-border bg-card md:flex">
          <nav className="flex flex-1 flex-col gap-1 py-4">
            <Link
              href="/portal/client-dashboard"
              className="text-foreground hover:bg-muted flex items-center gap-3 px-6 py-3 transition-colors"
            >
              <User className="text-muted-foreground size-5" />
              <span className="text-sm font-medium">Account Settings</span>
            </Link>
            <span className="border-primary bg-muted text-foreground flex items-center gap-3 border-l-4 px-6 py-3">
              <FolderOpen className="text-primary size-5" />
              <span className="text-sm font-bold">My Applications</span>
            </span>
            <Link
              href="/portal"
              className="text-foreground hover:bg-muted flex items-center gap-3 px-6 py-3 transition-colors"
            >
              <HelpCircle className="text-muted-foreground size-5" />
              <span className="text-sm font-medium">Portal overview</span>
            </Link>
          </nav>
        </aside>

        <main className="w-full flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
            <section className="flex w-full flex-col gap-4">
              <h2 className="text-foreground text-xl font-bold">
                Active Applications
              </h2>
              <div className="flex flex-col gap-6 border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-card-foreground text-lg font-bold">
                      Japan Tourist Visa
                    </h3>
                    <span className="border-success/20 text-success inline-flex items-center border bg-success/10 px-2.5 py-0.5 text-xs font-bold">
                      Processing
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Application ID: JPN-2023-8942
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Submission Date: Oct 12, 2023
                  </p>
                </div>
                <Button variant="outline" className="w-full font-bold md:w-auto">
                  View Details
                </Button>
              </div>
            </section>

            <section className="flex w-full flex-col gap-6">
              <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-foreground text-xl font-bold">
                  Available Destinations
                </h2>
                <Link
                  href="/portal/application-workspace"
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "bg-primary text-primary-foreground hover:bg-primary/90 w-full gap-2 border-0 font-bold sm:w-auto",
                  )}
                >
                  <Plus className="size-5" />
                  Start Application
                </Link>
              </div>
              <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {destinations.map((d) => (
                  <div
                    key={d.title}
                    className="group mx-auto flex w-full max-w-[400px] flex-col overflow-hidden border border-border bg-card transition-all hover:border-b-2 hover:border-b-foreground sm:mx-0 sm:max-w-none"
                  >
                    <div className="relative h-40 w-full bg-muted">
                      <Image
                        src={d.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <h3 className="text-card-foreground text-lg font-bold">
                        {d.title}
                      </h3>
                      <p className="text-muted-foreground flex-1 text-sm">
                        {d.description}
                      </p>
                      <div className="mt-auto pt-4">
                        <Link
                          href="/portal/application-workspace"
                          className="text-link flex items-center gap-1 text-sm font-bold hover:underline"
                        >
                          View Requirements
                          <ArrowRight className="size-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <p className="text-muted-foreground text-center text-sm">
              <Link href="/portal" className="hover:text-foreground underline">
                All portal screens
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
