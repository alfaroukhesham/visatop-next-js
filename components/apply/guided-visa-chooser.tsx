"use client";

import { useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import {
  Baby,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  Clock3,
  Plane,
  Repeat2,
  UserRound,
} from "lucide-react";
import { APPLY_STAY_LABELS } from "@/lib/apply/apply-stay-labels";
import {
  defaultEntryForStay,
  filterGuidedServices,
  needsEntryQuestion,
  needsKindQuestion,
  nextPhaseAfterEntry,
  nextPhaseAfterStay,
  stayOptionsForChooser,
  type TChooserPhase,
} from "@/lib/apply/guided-visa-filter";
import type { TEntryKind, TStayBucket, TTravelerKind } from "@/lib/catalog/guided-choice";
import { cn } from "@/lib/utils";

export interface IService {
  id: string;
  name: string;
  durationDays: number | null;
  entries: string | null;
  displayPriceMinor: string | null;
  currency: string | null;
  stayBucket: TStayBucket | null;
  entryKind: TEntryKind;
  travelerKind: TTravelerKind;
  showInGuidedChooser: boolean;
}

export interface IGuidedVisaChooserProps {
  services: IService[];
  formatPrice: (s: IService) => { text: string; isEstimate: boolean } | null;
  selectedServiceId: string;
  onSelectService: (id: string) => void;
  partyEnabled?: boolean;
  canAddTraveler?: boolean;
  onAddTraveler?: () => void;
  onAnswersChange?: (answers: { stay: TStayBucket | null; entry: "single" | "multiple"; kind: TTravelerKind }) => void;
  onPhaseChange?: (phase: TChooserPhase) => void;
}

const EMPTY_SHORTLIST = "No visa matches these answers. Change your answers or contact us.";

const entriesLabel = (entries: string | null): string | null => {
  if (!entries) return null;
  const e = entries.toLowerCase();
  if (e.includes("multi")) return "Multiple entry";
  if (e.includes("single")) return "Single entry";
  return entries;
};

const compactFact = (value: string): string => value.toLowerCase().replace(/[\s\-–—·]/g, "");

/** Omit subtitle facts already spelled out in the product name (e.g. "14 Days - Single Entry"). */
export const serviceResultSubtitle = (
  name: string,
  durationDays: number | null,
  entryText: string | null,
): string | null => {
  const normalizedName = compactFact(name);
  const parts: string[] = [];
  if (durationDays != null) {
    const dayFact = compactFact(`${durationDays} days`);
    const dayFactSingular = compactFact(`${durationDays} day`);
    if (!normalizedName.includes(dayFact) && !normalizedName.includes(dayFactSingular)) {
      parts.push(`${durationDays} days`);
    }
  }
  if (entryText) {
    const entryFact = compactFact(entryText);
    const entryStem = entryFact.replace(/entry$/, "");
    if (!normalizedName.includes(entryFact) && !normalizedName.includes(entryStem)) {
      parts.push(entryText);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
};

const STAY_TILE_META: Record<TStayBucket, { hint: string; icon: FC<{ className?: string }> }> = {
  "1_14": { hint: "Short trip", icon: Clock3 },
  "15_30": { hint: "Up to a month", icon: CalendarDays },
  "31_60": { hint: "Extended stay", icon: CalendarRange },
  transit: { hint: "Passing through", icon: Plane },
  "5_year": { hint: "Long-term", icon: CalendarClock },
};

interface IStayChoiceTileProps {
  selected: boolean;
  label: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
}

const StayChoiceTile: FC<IStayChoiceTileProps> = ({ selected, label, hint, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "group relative w-full overflow-hidden rounded-2xl border-2 px-5 py-5 text-left transition-all duration-200",
      selected
        ? "border-secondary bg-accent shadow-[inset_0_0_0_1px_rgba(34,77,100,0.18),0_12px_32px_rgba(34,77,100,0.14)]"
        : "border-border bg-card hover:border-secondary/50 hover:shadow-[0_8px_24px_rgba(1,32,49,0.06)]",
    )}
  >
    {selected ? <span className="bg-primary absolute inset-y-0 left-0 w-1.5" aria-hidden /> : null}
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em]",
            selected ? "text-secondary" : "text-muted-foreground",
          )}
        >
          <span className="inline-flex shrink-0" aria-hidden>
            {icon}
          </span>
          {hint}
        </span>
        <span
          className={cn(
            "font-heading mt-2 block text-xl font-bold leading-tight tracking-tight sm:text-2xl",
            selected ? "text-secondary" : "text-foreground",
          )}
        >
          {label}
        </span>
      </div>
      <span
        className={cn(
          "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-secondary bg-secondary text-white"
            : "border-border text-transparent group-hover:border-secondary/40",
        )}
        aria-hidden
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    </div>
  </button>
);

interface IChoiceButtonProps {
  selected: boolean;
  label: string;
  hint?: string;
  icon: ReactNode;
  onClick: () => void;
}

const ChoiceButton: FC<IChoiceButtonProps> = ({ selected, label, hint, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      "group relative flex min-h-24 w-full items-center gap-3 rounded-2xl border-2 bg-card px-4 py-4 text-left shadow-[0_10px_30px_rgba(1,32,49,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary hover:shadow-[0_14px_34px_rgba(1,32,49,0.1)]",
      selected ? "border-secondary bg-accent/70 ring-2 ring-secondary/10" : "border-border",
    )}
  >
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-secondary transition-colors",
        selected && "bg-secondary text-white",
      )}
      aria-hidden
    >
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className={cn("text-foreground block text-base font-semibold", selected && "text-secondary")}>
        {label}
      </span>
      {hint ? <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{hint}</span> : null}
    </span>
    <span
      className={cn(
        "border-secondary/40 text-secondary flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-secondary bg-secondary text-white" : "bg-card",
      )}
      aria-hidden
    >
      {selected ? <Check className="size-4" strokeWidth={3} /> : null}
    </span>
  </button>
);

export const GuidedVisaChooser: FC<IGuidedVisaChooserProps> = ({
  services,
  formatPrice,
  selectedServiceId,
  onSelectService,
  partyEnabled = false,
  canAddTraveler = false,
  onAddTraveler,
  onAnswersChange,
  onPhaseChange,
}) => {
  const stayBuckets = useMemo(() => stayOptionsForChooser(services), [services]);
  const [phase, setPhase] = useState<TChooserPhase>("stay");
  const [stay, setStay] = useState<TStayBucket | null>(null);
  const [entry, setEntry] = useState<"single" | "multiple">("single");
  const [kind, setKind] = useState<TTravelerKind>("adult");

  useEffect(() => {
    onAnswersChange?.({ stay, entry, kind });
  }, [stay, entry, kind, onAnswersChange]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const matches = useMemo(() => {
    if (!stay) return [];
    const ids = new Set(filterGuidedServices(services, { stay, entry, kind }).map((s) => s.id));
    return services.filter((s) => ids.has(s.id));
  }, [services, stay, entry, kind]);

  const questionSteps = useMemo((): TChooserPhase[] => {
    const steps: TChooserPhase[] = ["stay"];
    if (!stay) return steps;
    if (needsEntryQuestion(services, stay)) steps.push("entry");
    if (needsKindQuestion(services, stay)) steps.push("kind");
    return steps;
  }, [services, stay]);

  const questionIndex = Math.max(1, questionSteps.indexOf(phase) + 1);
  const totalQuestions = questionSteps.length;

  const goStay = (next: TStayBucket) => {
    setStay(next);
    setEntry(defaultEntryForStay(services, next));
    setKind("adult");
    onSelectService("");
    setPhase(nextPhaseAfterStay(services, next));
  };

  const goEntry = (next: "single" | "multiple") => {
    setEntry(next);
    setKind("adult");
    onSelectService("");
    setPhase(nextPhaseAfterEntry(services, stay ?? "1_14"));
  };

  const goKind = (next: TTravelerKind) => {
    setKind(next);
    onSelectService("");
    setPhase("results");
  };

  const goBack = () => {
    onSelectService("");
    if (phase === "results") {
      if (stay && nextPhaseAfterEntry(services, stay) === "kind") return void setPhase("kind");
      if (stay && needsEntryQuestion(services, stay)) return void setPhase("entry");
      return void setPhase("stay");
    }
    if (phase === "kind") return void setPhase(stay && needsEntryQuestion(services, stay) ? "entry" : "stay");
    if (phase === "entry") setPhase("stay");
  };

  const phaseLabel =
    phase === "results"
      ? "Your visa shortlist"
      : phase === "stay"
        ? "Your trip"
        : phase === "entry"
          ? "Entry preference"
          : "Traveller type";
  const progress = phase === "results" ? 100 : Math.round((questionIndex / totalQuestions) * 100);

  return (
    <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/35 p-3 sm:p-5">
      {phase !== "stay" ? (
        <button
          type="button"
          onClick={goBack}
          className="text-secondary hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden /> Back
        </button>
      ) : null}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.2em]">
            {phase === "results" ? "Ready to apply" : `Step ${questionIndex} of ${totalQuestions}`}
          </p>
          <p className="text-muted-foreground text-xs font-medium">{phaseLabel}</p>
        </div>
        <div className="bg-border h-1 overflow-hidden rounded-full" aria-hidden>
          <div
            className="bg-secondary h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div key={phase} className="theme-client-rise space-y-4">
        {phase === "stay" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl">
              <h3 className="font-heading text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                How long is your stay?
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {stayBuckets.map((b) => {
                const meta = STAY_TILE_META[b];
                const Icon = meta.icon;
                return (
                  <StayChoiceTile
                    key={b}
                    selected={stay === b}
                    label={APPLY_STAY_LABELS[b]}
                    hint={meta.hint}
                    icon={<Icon className="size-3.5" />}
                    onClick={() => goStay(b)}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
        {phase === "entry" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl">
              <h3 className="font-heading text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                Single or multiple entry?
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceButton
                selected={entry === "single"}
                label="Single entry"
                hint="One arrival into the country"
                icon={<Plane className="size-6" />}
                onClick={() => goEntry("single")}
              />
              <ChoiceButton
                selected={entry === "multiple"}
                label="Multiple entry"
                hint="Leave and return while the visa is valid"
                icon={<Repeat2 className="size-6" />}
                onClick={() => goEntry("multiple")}
              />
            </div>
          </div>
        ) : null}
        {phase === "kind" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl">
              <h3 className="font-heading text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                Who is this visa for?
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceButton
                selected={kind === "adult"}
                label="Adult"
                icon={<UserRound className="size-6" />}
                onClick={() => goKind("adult")}
              />
              <ChoiceButton
                selected={kind === "child"}
                label="Child"
                icon={<Baby className="size-6" />}
                onClick={() => goKind("child")}
              />
            </div>
          </div>
        ) : null}
        {phase === "results" ? (
          matches.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed" role="status">
              {EMPTY_SHORTLIST}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm text-secondary">
                Matching visas for a {stay ? APPLY_STAY_LABELS[stay].toLowerCase() : "selected"} stay
                {kind === "child" ? " · child traveller" : " · adult traveller"}
              </div>
              <ul className="space-y-3">
                {matches.map((s) => {
                  const price = formatPrice(s);
                  const entryText = entriesLabel(s.entries);
                  const subtitle = serviceResultSubtitle(s.name, s.durationDays, entryText);
                  const selected = selectedServiceId === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onSelectService(s.id)}
                        aria-pressed={selected}
                        className={cn(
                          "border-border bg-card relative flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-5 text-left shadow-[0_10px_28px_rgba(1,32,49,0.05)] transition-all hover:-translate-y-0.5 hover:border-secondary",
                          selected ? "border-secondary bg-accent/70 ring-2 ring-secondary/10" : "",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-secondary",
                            selected && "bg-secondary text-white",
                          )}
                          aria-hidden
                        >
                          {selected ? <Check className="size-5" strokeWidth={3} /> : <Plane className="size-5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "text-foreground block text-base font-semibold leading-snug",
                              selected && "text-secondary",
                            )}
                          >
                            {s.name}
                          </span>
                          {subtitle ? (
                            <span className="text-muted-foreground mt-1 block text-xs">{subtitle}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-right">
                          {price ? (
                            <>
                              <span className="font-heading text-foreground block text-lg font-bold tabular-nums">
                                {price.text}
                              </span>
                              {price.isEstimate ? (
                                <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-wide">
                                  Estimate
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">At checkout</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ) : null}
        {phase === "results" && matches.length > 0 && partyEnabled && selectedServiceId ? (
          <div className="border-border bg-card space-y-3 rounded-2xl border-2 px-5 py-5 shadow-[0_10px_28px_rgba(1,32,49,0.05)]">
            <p className="text-foreground text-sm font-semibold">Travelling with others?</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Add another traveller to this checkout. Each person can have a different visa.
            </p>
            <button
              type="button"
              onClick={() => onAddTraveler?.()}
              disabled={!canAddTraveler}
              className="border-secondary text-secondary hover:bg-secondary hover:text-white rounded-xl border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add traveller
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
