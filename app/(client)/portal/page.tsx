import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  FileText,
  LayoutDashboard,
  PenLine,
} from "lucide-react";
import {
  CardDescription,
  CardHeader,
  ClientCard,
  CardTitle,
} from "@/components/client/client-card";

const links = [
  {
    href: "/apply/start",
    title: "New application",
    description: "Nationality, visa type, documents, and payment in one guided flow.",
    icon: PenLine,
  },
  {
    href: "/portal/drafts",
    title: "Draft applications",
    description: "Continue any in-progress drafts before they expire.",
    icon: LayoutDashboard,
  },
  {
    href: "/apply/track",
    title: "Track application",
    description: "See a clear, plain-language status for every application on your account (or guest email).",
    icon: Briefcase,
  },
  {
    href: "/portal/documents",
    title: "My documents",
    description: "Store your passport, photo, and supporting files once—reuse them across applications.",
    icon: FileText,
  },
] as const;

export default function PortalHomePage() {
  return (
    <main className="relative mx-auto flex w-full max-w-[calc(1300px+3rem)] flex-1 flex-col px-5 py-12 sm:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(252,205,100,0.18),transparent_70%)]"
        aria-hidden
      />
      <div className="relative space-y-10">
        <header className="max-w-2xl space-y-4">
          <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">Your portal</p>
          <h1 className="font-heading text-foreground text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.08] tracking-tight">
            Pick up where you left off
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Start a new visa file, open your dashboard, or browse every application tied to this account.
          </p>
        </header>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="group block h-full">
                <ClientCard className="border-secondary/25 h-full overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-secondary/45 hover:shadow-[0_18px_48px_rgba(1,32,49,0.1)]">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="bg-primary/20 text-secondary flex size-12 items-center justify-center rounded-[10px] border-2 border-primary/35 shadow-sm">
                        <Icon className="size-5 shrink-0" aria-hidden />
                      </div>
                      <ArrowRight className="text-muted-foreground group-hover:text-secondary size-5 shrink-0 transition-colors" />
                    </div>
                    <CardTitle className="font-heading mt-4 text-xl text-foreground">{title}</CardTitle>
                    <CardDescription className="text-muted-foreground text-base leading-relaxed">
                      {description}
                    </CardDescription>
                  </CardHeader>
                </ClientCard>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
