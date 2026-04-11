import Link from "next/link";
import { Bolt, Delete, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const nav: {
  href: string;
  label: string;
  current?: boolean;
}[] = [
  { href: "/admin/operations", label: "Operations" },
  { href: "/admin/automations", label: "Automations", current: true },
];

const rules = [
  {
    name: "Passport OCR Approval",
    trigger: "On Upload",
    active: true,
  },
  {
    name: "Visa Fee Routing",
    trigger: "Payment Success",
    active: false,
  },
  {
    name: "Auto-Reject Underage",
    trigger: "Form Submit",
    active: false,
  },
] as const;

export const metadata = {
  title: "Admin automations | Unified Hybrid Portal",
};

export default function AdminAutomationsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="w-full overflow-x-hidden bg-card border-b border-border">
        <div className="mx-auto flex max-w-[960px] flex-1 flex-col px-4 py-5 md:px-10 lg:px-40">
          <header className="flex items-center justify-between gap-4 px-4 py-3 md:px-10">
            <div className="flex items-center gap-4">
              <div className="text-primary size-4 shrink-0">
                <svg
                  fill="none"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <Link
                href="/admin"
                className="text-foreground hover:text-primary text-lg font-bold tracking-tight"
              >
                Unified Portal
              </Link>
            </div>
            <nav className="hidden flex-1 justify-end gap-6 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    item.current
                      ? "border-primary text-foreground border-b-2 pb-1 text-sm font-medium"
                      : "text-muted-foreground hover:text-foreground text-sm font-medium"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col border-t border-border bg-background lg:flex-row">
        <aside className="border-border flex max-h-[40vh] w-full flex-col overflow-y-auto border-b border-r-0 bg-muted/30 lg:h-[calc(100vh-5rem)] lg:max-h-none lg:w-[30%] lg:min-w-[240px] lg:border-b-0 lg:border-r">
          <div className="border-border sticky top-0 z-10 flex items-center justify-between border-b bg-card p-6">
            <h2 className="text-xl font-bold">Active Rules</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-none"
              aria-label="Add rule"
            >
              <Plus className="size-5" />
            </Button>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {rules.map((rule) => (
              <div
                key={rule.name}
                className={
                  rule.active
                    ? "border-primary group relative flex cursor-pointer items-center justify-between rounded-none border bg-card p-4"
                    : "border-border group relative flex cursor-pointer items-center justify-between rounded-none border bg-card p-4 transition-colors hover:border-foreground"
                }
              >
                <div>
                  <h3
                    className={rule.active ? "text-sm font-semibold" : "text-sm font-medium"}
                  >
                    {rule.name}
                  </h3>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    Trigger: {rule.trigger}
                  </p>
                </div>
                <button
                  type="button"
                  title="Delete rule"
                  className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Delete className="size-5" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="relative flex min-h-[50vh] w-full flex-1 flex-col overflow-y-auto bg-card lg:h-[calc(100vh-5rem)] lg:w-[70%]">
          <div className="border-border sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b bg-card p-6">
            <div>
              <h1 className="text-2xl font-bold">Edit Rule</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure logic for: Passport OCR Approval
              </p>
            </div>
            <Button type="button" className="gap-2 rounded-none">
              <Save className="size-4" />
              Save Rule
            </Button>
          </div>

          <div className="max-w-4xl p-8">
            <div className="mb-8">
              <Label className="mb-3 block text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Trigger
              </Label>
              <div className="border-border flex flex-wrap items-center gap-4 border bg-muted/30 p-4">
                <Bolt className="text-muted-foreground size-6" aria-hidden />
                <select className="border-border bg-card text-foreground w-64 rounded-none border px-3 py-2 text-sm font-mono shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none">
                  <option>On Upload</option>
                  <option>On Submit</option>
                  <option>Daily at 00:00</option>
                </select>
                <span className="text-muted-foreground text-sm">Document Type:</span>
                <select className="border-border bg-card text-foreground w-48 rounded-none border px-3 py-2 text-sm font-mono shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none">
                  <option>Passport</option>
                  <option>ID Card</option>
                  <option>Visa</option>
                </select>
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-muted-foreground block text-xs font-bold tracking-wider uppercase">
                  Conditions (IF)
                </Label>
                <button
                  type="button"
                  className="text-link flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  <Plus className="size-4" />
                  Add Condition
                </button>
              </div>
              <div className="relative space-y-4 pl-8 before:absolute before:inset-y-0 before:left-4 before:w-px before:bg-border">
                <div className="border-border relative border bg-card p-5">
                  <div className="text-muted-foreground absolute -left-[33px] top-6 rounded-none border border-border bg-muted px-2 py-1 text-xs font-bold">
                    IF
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <select className="border-border bg-card text-foreground w-48 rounded-none border px-3 py-2 text-sm font-mono shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none">
                      <option>Extracted.Country</option>
                      <option>Extracted.ExpiryDate</option>
                    </select>
                    <select className="border-border bg-muted/30 text-foreground w-32 rounded-none border px-3 py-2 text-sm font-mono shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none">
                      <option>Equals</option>
                      <option>Not Equals</option>
                      <option>Contains</option>
                    </select>
                    <Input
                      defaultValue="USA"
                      className="w-48 rounded-none font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="border-border relative border bg-card p-5">
                  <div className="text-muted-foreground absolute -left-[37px] top-6 rounded-none border border-border bg-muted px-2 py-1 text-xs font-bold">
                    AND
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <select className="border-border bg-card text-foreground w-48 rounded-none border px-3 py-2 text-sm font-mono shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none">
                        <option>OCR.Confidence</option>
                      </select>
                      <select className="border-border bg-muted/30 text-foreground w-32 rounded-none border px-3 py-2 text-sm font-mono shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none">
                        <option>Greater Than</option>
                        <option>Less Than</option>
                      </select>
                      <span className="text-foreground w-16 text-right font-mono text-lg font-bold">
                        85%
                      </span>
                    </div>
                    <div className="pr-12 pl-[208px] max-md:pl-0">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        defaultValue={85}
                        className="accent-primary w-full"
                        aria-label="OCR confidence threshold"
                      />
                      <div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-3 block text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Actions (THEN)
              </Label>
              <div className="border-border relative border bg-muted/30 p-5">
                <div className="absolute -left-3 top-6 rounded-none bg-foreground px-2 py-1 text-xs font-bold text-background">
                  THEN
                </div>
                <div className="flex flex-wrap items-center gap-4 pl-6">
                  <span className="text-foreground text-sm font-medium">
                    Set Status to:
                  </span>
                  <select className="border-border bg-card text-success w-48 rounded-none border px-3 py-2 text-sm font-mono font-bold shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none">
                    <option>Auto-Approve</option>
                    <option>Manual Review</option>
                    <option>Reject</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

