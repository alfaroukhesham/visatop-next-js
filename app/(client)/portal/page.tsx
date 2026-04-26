import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
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
    title: "Start application",
    description: "Pick nationality + service to create a draft (guests welcome).",
    icon: PenLine,
  },
  {
    href: "/portal/client-dashboard",
    title: "Client dashboard",
    description: "Overview and shortcuts to destinations.",
    icon: LayoutDashboard,
  },
  {
    href: "/portal/application-workspace",
    title: "Application workspace",
    description: "Deep-link friendly list and workspace entry.",
    icon: Briefcase,
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
        <header className="max-w-2xl space-y-3">
          <p className="text-secondary text-xs font-semibold uppercase tracking-[0.2em]">Portal hub</p>
          <h1 className="font-heading text-[#012031] text-3xl font-semibold tracking-tight md:text-4xl">
            Where do you want to go?
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Jump into applications, your dashboard, or the legacy workspace — same brand experience across
            the portal.
          </p>
        </header>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="group block h-full">
                <ClientCard className="border-secondary/15 h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/35">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="bg-primary/15 text-secondary flex size-11 items-center justify-center rounded-[10px] border border-primary/25">
                        <Icon className="size-5 shrink-0" aria-hidden />
                      </div>
                      <ArrowRight className="text-muted-foreground group-hover:text-secondary size-5 shrink-0 transition-colors" />
                    </div>
                    <CardTitle className="font-heading mt-4 text-xl text-[#012031]">{title}</CardTitle>
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
