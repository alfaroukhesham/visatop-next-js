import Link from "next/link";
import { ArrowRight, Globe2, Settings2, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const links = [
  {
    href: "/admin/catalog",
    title: "Catalog & pricing",
    description: "Nationalities, services, margins, and reference prices.",
    icon: Globe2,
  },
  {
    href: "/admin/operations",
    title: "Operations",
    description: "Verification queue and review drawer.",
    icon: Settings2,
  },
  {
    href: "/admin/automations",
    title: "Automations",
    description: "Rule list and IF / THEN editor.",
    icon: Sparkles,
  },
] as const;

export default function AdminHomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin</h1>
            <p className="text-muted-foreground text-sm">
              Signed-in area — pick a screen to open.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              Back to home
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <ul className="grid gap-4 sm:grid-cols-2">
          {links.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="block h-full">
                <Card className="h-full border-border transition-colors hover:border-foreground">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className="text-primary size-5 shrink-0" />
                        <CardTitle className="text-lg">{title}</CardTitle>
                      </div>
                      <ArrowRight className="text-muted-foreground size-4 shrink-0" />
                    </div>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

