"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  Info,
  MoreVertical,
  Search,
  X,
  ZoomIn,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  applicant: string;
  destination: string;
  date: string;
  status: "pending" | "processing" | "awaiting";
  statusLabel: string;
};

const rows: Row[] = [
  {
    id: "VA-7829",
    applicant: "Eleanor Shellstrop",
    destination: "Japan",
    date: "Oct 24, 2023",
    status: "pending",
    statusLabel: "Pending Verification",
  },
  {
    id: "VA-7828",
    applicant: "Chidi Anagonye",
    destination: "United Kingdom",
    date: "Oct 24, 2023",
    status: "awaiting",
    statusLabel: "Awaiting Embassy",
  },
  {
    id: "VA-7827",
    applicant: "Tahani Al-Jamil",
    destination: "Australia",
    date: "Oct 23, 2023",
    status: "processing",
    statusLabel: "Processing OCR",
  },
  {
    id: "VA-7826",
    applicant: "Jianyu Li",
    destination: "Canada",
    date: "Oct 23, 2023",
    status: "pending",
    statusLabel: "Pending Verification",
  },
  {
    id: "VA-7825",
    applicant: "Michael Realman",
    destination: "Japan",
    date: "Oct 22, 2023",
    status: "awaiting",
    statusLabel: "Awaiting Embassy",
  },
];

function badgeClass(status: Row["status"]) {
  switch (status) {
    case "pending":
      return "border-l-[#F0AB00]";
    case "processing":
      return "border-l-[#0066CC]";
    case "awaiting":
      return "border-l-[#3E8635]";
    default:
      return "";
  }
}

export function AdminOperationsClient() {
  const [selected, setSelected] = useState<Row | null>(rows[0]!);
  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <div className="bg-background text-foreground flex h-screen flex-col overflow-hidden">
      <div className="w-full shrink-0 overflow-x-hidden bg-card">
        <div className="mx-auto flex max-w-[1200px] flex-1 flex-col px-4 py-5 md:px-10 lg:px-40">
          <header className="border-border flex items-center justify-between gap-4 border-b border-solid px-4 py-3 md:px-10">
            <div className="flex items-center gap-4 text-foreground">
              <div className="text-primary size-4 shrink-0">
                <svg
                  fill="none"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <Link
                href="/admin"
                className="text-foreground hover:text-primary text-lg font-bold leading-tight tracking-tight"
              >
                Unified Hybrid Portal
              </Link>
            </div>
            <div className="flex items-center justify-end gap-6">
              <ThemeToggle />
              <div className="border-border relative size-10 shrink-0 overflow-hidden rounded-full border bg-muted bg-cover bg-center bg-no-repeat">
                <Image
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo3uM14BIMK2TwKJki-AI1KEavcHo51tnlutq7qV29dqdMHE2hKnan31JLsvCTZV5_sMQqD7Eq0l8SihZqKZahnrY33OfDa-B1reUSNGTlz90UNKAsG-wpyTjos5aTwB5BtvQUrgNhrBDkIy8Wl7qW2X9Po6Huy27-MhPCBVy3j7t1AnmCyzf78HAtVxrraFL9ZFx37AgfV46xCI-qBYTXUoHopaYmCi6_ZvIWaOWLLGXLDcCm8Rpzs57roOGj5YocNur-7T3SKQM"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
            </div>
          </header>
          <div className="flex flex-wrap items-end justify-between gap-4 p-4 pb-6 pt-8 md:px-10">
            <div className="flex min-w-72 flex-col gap-2">
              <h1 className="text-foreground text-[32px] font-bold leading-tight tracking-tight">
                Admin Operations
              </h1>
              <p className="text-muted-foreground text-sm font-normal leading-normal">
                Centralized queue for agent document verification
              </p>
            </div>
            <div className="w-full md:w-auto md:min-w-[320px]">
              <label className="flex h-10 w-full flex-col">
                <div className="border-border focus-within:border-foreground flex h-full w-full flex-1 items-stretch border bg-card shadow-sm transition-colors">
                  <div className="text-muted-foreground flex items-center justify-center pl-3">
                    <Search className="size-5" />
                  </div>
                  <Input
                    className="text-muted-foreground h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
                    placeholder="Search applicant or ID..."
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <main className="relative mx-auto flex w-full max-w-[1200px] flex-1 overflow-hidden px-4 pb-10 md:px-10 lg:px-40">
        <section className="border-border bg-card z-10 flex flex-1 flex-col overflow-hidden border shadow-sm">
          <div className="border-border bg-muted flex items-center justify-between border-b px-4 py-3">
            <div className="flex flex-wrap gap-4">
              <div className="relative">
                <select className="border-border bg-card text-foreground focus:border-primary focus:ring-primary appearance-none rounded-none border py-1.5 pr-8 pl-3 text-sm focus:ring-1">
                  <option value="">All Statuses</option>
                  <option value="pending">Pending Verification</option>
                  <option value="processing">Processing OCR</option>
                  <option value="awaiting">Awaiting Embassy</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute right-2 top-1/2 size-[18px] -translate-y-1/2" />
              </div>
              <div className="relative">
                <select className="border-border bg-card text-foreground focus:border-primary focus:ring-primary appearance-none rounded-none border py-1.5 pr-8 pl-3 text-sm focus:ring-1">
                  <option value="">All Destinations</option>
                  <option value="jp">Japan</option>
                  <option value="uk">United Kingdom</option>
                  <option value="au">Australia</option>
                  <option value="ca">Canada</option>
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute right-2 top-1/2 size-[18px] -translate-y-1/2" />
              </div>
            </div>
            <div className="text-muted-foreground font-mono text-xs">
              Showing 1-12 of 248 records
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left whitespace-nowrap">
              <thead className="border-border bg-muted sticky top-0 z-10 border-b">
                <tr>
                  <th className="text-muted-foreground w-24 px-4 py-3 text-xs font-semibold tracking-wider uppercase">
                    ID
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wider uppercase">
                    Applicant
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wider uppercase">
                    Destination
                  </th>
                  <th className="text-muted-foreground hidden px-4 py-3 text-xs font-semibold tracking-wider uppercase md:table-cell">
                    Date
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wider uppercase">
                    Status
                  </th>
                  <th className="text-muted-foreground w-10 px-4 py-3 text-center text-xs font-semibold tracking-wider uppercase" />
                </tr>
              </thead>
              <tbody className="divide-border divide-y text-sm">
                {rows.map((row) => {
                  const isSel = selected?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={
                        isSel
                          ? "border-primary bg-muted hover:bg-muted h-12 cursor-pointer border-l-2"
                          : "border-l-transparent hover:bg-muted h-12 cursor-pointer border-l-2"
                      }
                      onClick={() => {
                        setSelected(row);
                        setDrawerOpen(true);
                      }}
                    >
                      <td className="text-muted-foreground px-4 font-mono">
                        {row.id}
                      </td>
                      <td className="text-foreground px-4 font-medium">
                        {row.applicant}
                      </td>
                      <td className="text-foreground px-4">{row.destination}</td>
                      <td className="text-muted-foreground hidden px-4 md:table-cell">
                        {row.date}
                      </td>
                      <td className="px-4">
                        <div
                          className={`border-border bg-muted text-foreground inline-flex items-center rounded-none border px-2 py-0.5 text-xs font-medium border-l-4 ${badgeClass(row.status)}`}
                        >
                          {row.statusLabel}
                        </div>
                      </td>
                      <td className="px-4 text-center">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground focus:outline-none"
                          aria-label="Row actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside
          className={
            drawerOpen && selected
              ? "border-border bg-card fixed inset-y-0 right-0 z-20 flex w-full translate-x-0 flex-col border-l shadow-xl transition-transform duration-300 ease-in-out sm:absolute sm:top-0 sm:h-full sm:w-[400px]"
              : "border-border bg-card fixed inset-y-0 right-0 z-20 flex w-full translate-x-full flex-col border-l shadow-xl transition-transform duration-300 ease-in-out sm:absolute sm:top-0 sm:h-full sm:w-[400px]"
          }
          aria-hidden={!drawerOpen || !selected}
        >
          {selected ? (
            <>
              <div className="border-border flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h3 className="text-foreground text-lg font-bold">
                    Review Application
                  </h3>
                  <p className="text-muted-foreground mt-1 font-mono text-sm">
                    {selected.id}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close drawer"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X className="size-6" />
                </Button>
              </div>
              <div className="bg-muted flex flex-1 flex-col gap-6 overflow-y-auto p-6">
                {selected.id === "VA-7829" ? (
                  <>
                    <div className="border-border bg-card p-4">
                      <div className="mb-4 flex items-center gap-4">
                        <div className="border-border relative h-12 w-12 overflow-hidden rounded-full border bg-muted">
                          <Image
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWGc04oG0NB-VSL-RfHuSDKfhd6WBpNRkpkuOtwsGO0udGhWF9AFoYNwvZJRvCPJz9VWEa7iibYQ_ag2uSANZeeWQoXzWuYIG_DtSeZOVHc4m9Zvis0GAA503LO2bNxY-zqb2EzBLR8nutvamdV6V-9fCmuk9ITGnoxiRLg2sCfw7PLmmU4s_OJEQJAfbzgbHPlnZzVaFRhok6xrzDHhUTw-wmAmE86EUz3Bk3jaNgWHW6ErryC1UkZ-kUfmm5l87qsC7uIvF2YaM"
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                        <div>
                          <h4 className="text-foreground font-bold">
                            Eleanor Shellstrop
                          </h4>
                          <p className="text-muted-foreground text-sm">
                            eleanor.s@example.com
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1 text-xs">
                            Destination
                          </p>
                          <p className="text-foreground font-medium">
                            Japan (Tourist)
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1 text-xs">
                            Submission Date
                          </p>
                          <p className="text-foreground font-medium">
                            Oct 24, 2023
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <h4 className="text-foreground text-sm font-bold tracking-wide uppercase">
                        Passport Verification
                      </h4>
                      <div className="border-border relative flex h-48 w-full items-center justify-center overflow-hidden border bg-muted">
                        <Image
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGRJqDucjw9dV2JyG-XEVX3W2lQtNPbyIbSdoVGO_in09WCXPWd9WuQecJ4D_YMszVVyw8f2GiR90-TgRhtGLa246OHRz--HT0dDOnJI1RR93s6aWZEYc48_35aXzSy0PeWeGZPfGufACra0OqwOgZvcSqRlH3SQ7izGyVUn6L3AkLwRuiteVONJniv-5024PmQHn_t0FR-2jhVZlLDuREM4NiA5Jf2IaaG_JjpL5TDLxufUkiEfg74QfMz8AFnZHfRRsqxNZ8NR0"
                          alt="Passport sample"
                          fill
                          className="object-cover opacity-80 mix-blend-multiply"
                          sizes="400px"
                        />
                        <div className="border-[#F0AB00] absolute top-1/4 left-1/4 z-20 h-1/3 w-1/2 border-2 bg-[#F0AB00]/10 pointer-events-none" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-border bg-card/90 text-foreground absolute right-2 bottom-2 z-30 gap-1 rounded-none text-xs"
                        >
                          <ZoomIn className="size-3.5" />
                          View Full
                        </Button>
                      </div>
                      <div className="border-border bg-card border">
                        <div className="border-border flex items-center justify-between border-b bg-muted px-4 py-2">
                          <span className="text-muted-foreground text-xs font-semibold uppercase">
                            Extracted OCR Data
                          </span>
                          <span className="text-[#F0AB00] font-mono flex items-center gap-1 text-xs">
                            <AlertTriangle className="size-3.5" />
                            Review Needed
                          </span>
                        </div>
                        <div className="flex flex-col gap-3 p-4">
                          <div className="flex items-end justify-between border-border border-b pb-2">
                            <div>
                              <p className="text-muted-foreground mb-1 text-[11px] tracking-wider uppercase">
                                Document Number
                              </p>
                              <p className="text-foreground font-mono text-sm">
                                P89234710
                              </p>
                            </div>
                            <CheckCircle className="text-success size-[18px]" />
                          </div>
                          <div className="border-[#F0AB00]/30 bg-warning/5 -mx-2 flex items-end justify-between border-b p-2 pb-2">
                            <div>
                              <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[11px] tracking-wider uppercase">
                                Date of Birth
                                <Info className="text-[#F0AB00] size-3.5" />
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-muted-foreground font-mono text-sm line-through">
                                  14/10/1982
                                </p>
                                <p className="text-foreground font-mono text-sm font-bold">
                                  14/10/1992
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-none"
                              title="Accept correction"
                            >
                              <Check className="size-4" />
                            </Button>
                          </div>
                          <div className="flex items-end justify-between pb-1">
                            <div>
                              <p className="text-muted-foreground mb-1 text-[11px] tracking-wider uppercase">
                                Nationality
                              </p>
                              <p className="text-foreground font-mono text-sm">
                                USA
                              </p>
                            </div>
                            <CheckCircle className="text-success size-[18px]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Select a row to load verification details. Full passport
                    preview is available for applications in pending
                    verification.
                  </p>
                )}
              </div>
              <div className="border-border bg-card flex gap-3 border-t p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border text-foreground hover:bg-muted flex flex-1 items-center justify-between rounded-none text-left text-sm font-semibold"
                >
                  Reject
                  <X className="size-[18px]" />
                </Button>
                <Button
                  type="button"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-[2] items-center justify-between rounded-none text-left text-sm font-semibold"
                >
                  Verify &amp; Approve
                  <ArrowRight className="size-[18px]" />
                </Button>
              </div>
            </>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
