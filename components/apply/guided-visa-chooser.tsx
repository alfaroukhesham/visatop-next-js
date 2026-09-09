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
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import {
  defaultEntryForStay,
  defaultKindForStay,
  filterGuidedServices,
  needsEntryQuestion,
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
  initialPhase?: TChooserPhase;
  initialStay?: TStayBucket | null;
  initialEntry?: "single" | "multiple";
  initialKind?: TTravelerKind;
}

const EMPTY_SHORTLIST_KEY = "chooser.noMatches";

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

const STAY_TILE_META: Record<TStayBucket, { hintKey: string; icon: FC<{ className?: string }> }> = {
  "1_14": { hintKey: "chooser.stayHints.shortTrip", icon: Clock3 },
  "15_30": { hintKey: "chooser.stayHints.upToMonth", icon: CalendarDays },
  "31_60": { hintKey: "chooser.stayHints.extendedStay", icon: CalendarRange },
  transit: { hintKey: "chooser.stayHints.passingThrough", icon: Plane },
  "5_year": { hintKey: "chooser.stayHints.longTerm", icon: CalendarClock },
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
  initialPhase = "stay",
  initialStay = null,
  initialEntry = "single",
  initialKind = "adult",
}) => {
  const t = useCustomerT();
  const stayBuckets = useMemo(() => stayOptionsForChooser(services), [services]);
  const [phase, setPhase] = useState<TChooserPhase>(initialPhase);
  const [stay, setStay] = useState<TStayBucket | null>(initialStay);
  const [entry, setEntry] = useState<"single" | "multiple">(initialEntry);
  const [kind, setKind] = useState<TTravelerKind>(initialKind);

  const view = useMemo(() => {
    if (phase === "stay" && stayBuckets.length === 1 && stayBuckets[0]) {
      const next = stayBuckets[0];
      const nextEntry = defaultEntryForStay(services, next);
      const nextKind = defaultKindForStay(services, next, nextEntry);
      return {
        phase: nextPhaseAfterStay(services, next),
        stay: next,
        entry: nextEntry,
        kind: nextKind,
      };
    }
    if (phase === "stay" && stayBuckets.length === 0) {
      return { phase: "results" as const, stay: null, entry, kind };
    }
    return { phase, stay, entry, kind };
  }, [phase, stay, entry, kind, stayBuckets, services]);

  useEffect(() => {
    onAnswersChange?.({ stay: view.stay, entry: view.entry, kind: view.kind });
  }, [view.stay, view.entry, view.kind, onAnswersChange]);

  useEffect(() => {
    onPhaseChange?.(view.phase);
  }, [view.phase, onPhaseChange]);

  const matches = useMemo(() => {
    if (!view.stay) return services.filter((s) => s.showInGuidedChooser);
    const ids = new Set(
      filterGuidedServices(services, { stay: view.stay, entry: view.entry, kind: view.kind }).map((s) => s.id),
    );
    return services.filter((s) => ids.has(s.id));
  }, [services, view.stay, view.entry, view.kind]);

  const goStay = (next: TStayBucket) => {
    const nextEntry = defaultEntryForStay(services, next);
    const nextKind = defaultKindForStay(services, next, nextEntry);
    setStay(next);
    setEntry(nextEntry);
    setKind(nextKind);
    onSelectService("");
    setPhase(nextPhaseAfterStay(services, next));
  };

  const goEntry = (next: "single" | "multiple") => {
    const stayForEntry = view.stay ?? "1_14";
    const nextKind = defaultKindForStay(services, stayForEntry, next);
    setStay(stayForEntry);
    setEntry(next);
    setKind(nextKind);
    onSelectService("");
    setPhase(nextPhaseAfterEntry(services, stayForEntry, next));
  };

  const goKind = (next: TTravelerKind) => {
    setKind(next);
    onSelectService("");
    setPhase("results");
  };

  const goBack = () => {
    onSelectService("");
    if (view.phase === "results") {
      if (view.stay && nextPhaseAfterEntry(services, view.stay, view.entry) === "kind") {
        return void setPhase("kind");
      }
      if (view.stay && needsEntryQuestion(services, view.stay)) return void setPhase("entry");
      if (stayBuckets.length > 1) return void setPhase("stay");
      return;
    }
    if (view.phase === "kind") {
      if (view.stay && needsEntryQuestion(services, view.stay)) return void setPhase("entry");
      if (stayBuckets.length > 1) return void setPhase("stay");
      return;
    }
    if (view.phase === "entry" && stayBuckets.length > 1) setPhase("stay");
  };

  const showChooserBack =
    view.phase === "results" ||
    view.phase === "kind" ||
    (view.phase === "entry" && stayBuckets.length > 1);

  return (
    <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/35 p-3 sm:p-5">
      {showChooserBack ? (
        <button
          type="button"
          onClick={goBack}
          className="text-secondary hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden /> {t("chooser.back")}
        </button>
      ) : null}
      <div key={view.phase} className="theme-client-rise space-y-4">
        {view.phase === "stay" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl">
              <h3 className="font-heading text-foreground text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("chooser.howLongStay")}
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {stayBuckets.map((b) => {
                const meta = STAY_TILE_META[b];
                const Icon = meta.icon;
                return (
                  <StayChoiceTile
                    key={b}
                    selected={view.stay === b}
                    label={t(`chooser.stayLabels.${b}`)}
                    hint={t(meta.hintKey)}
                    icon={<Icon className="size-3.5" />}
                    onClick={() => goStay(b)}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
        {view.phase === "entry" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl">
              <h3 className="font-heading text-foreground text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("chooser.singleOrMultiple")}
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceButton
                selected={view.entry === "single"}
                label={t("chooser.singleEntry")}
                hint={t("chooser.singleEntryHint")}
                icon={<Plane className="size-6" />}
                onClick={() => goEntry("single")}
              />
              <ChoiceButton
                selected={view.entry === "multiple"}
                label={t("chooser.multipleEntry")}
                hint={t("chooser.multipleEntryHint")}
                icon={<Repeat2 className="size-6" />}
                onClick={() => goEntry("multiple")}
              />
            </div>
          </div>
        ) : null}
        {view.phase === "kind" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl">
              <h3 className="font-heading text-foreground text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                {t("chooser.whoIsVisaFor")}
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceButton
                selected={view.kind === "adult"}
                label={t("chooser.adult")}
                icon={<UserRound className="size-6" />}
                onClick={() => goKind("adult")}
              />
              <ChoiceButton
                selected={view.kind === "child"}
                label={t("chooser.child")}
                icon={<Baby className="size-6" />}
                onClick={() => goKind("child")}
              />
            </div>
          </div>
        ) : null}
        {view.phase === "results" ? (
          matches.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed" role="status">
              {t(EMPTY_SHORTLIST_KEY)}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm text-secondary">
                {t("chooser.matchingVisasBanner", {
                  stay: view.stay ? t(`chooser.stayLabels.${view.stay}`) : "",
                  travellerKind:
                    view.kind === "child" ? t("chooser.travellerKindChild") : t("chooser.travellerKindAdult"),
                })}
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
                                  {t("chooser.estimate")}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">{t("chooser.atCheckout")}</span>
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
        {view.phase === "results" && matches.length > 0 && partyEnabled && selectedServiceId ? (
          <div className="border-border bg-card space-y-3 rounded-2xl border-2 px-5 py-5 shadow-[0_10px_28px_rgba(1,32,49,0.05)]">
            <p className="text-foreground text-sm font-semibold">{t("chooser.travellingWithOthersTitle")}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("chooser.travellingWithOthersBody")}
            </p>
            <button
              type="button"
              onClick={() => onAddTraveler?.()}
              disabled={!canAddTraveler}
              className="border-secondary text-secondary hover:bg-secondary hover:text-white rounded-xl border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("chooser.addTraveller")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
