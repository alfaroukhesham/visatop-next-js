"use client";

import { useEffect, useMemo, useRef, useState, type FC, type ReactNode } from "react";
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
import { ClientButton } from "@/components/client/client-button";
import { APPLY_PROGRAMMATIC_HEADING_CLASS } from "@/components/apply/apply-primary-cta";
import { customerFacingServiceName } from "@/lib/apply/customer-service-name";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import {
  defaultEntryForStay,
  defaultKindForStay,
  entryOptionsForStay,
  filterGuidedServices,
  kindOptionsForStay,
  needsEntryQuestion,
  nextPhaseAfterEntry,
  nextPhaseAfterStay,
  stayOptionsForChooser,
  type TChooserPhase,
} from "@/lib/apply/guided-visa-filter";
import type { TEntryKind, TStayBucket, TTravelerKind } from "@/lib/catalog/guided-choice";
import { cn } from "@/lib/utils";
import { TravelDateStep } from "@/components/apply/travel-date-step";

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
  showDateStep?: boolean;
  travelDate?: string;
  onTravelDateChange?: (value: string) => void;
  todayUae?: string;
  maxTravelDate?: string;
  selectedVisaExtra?: ReactNode;
  /** Edit mode: visa, date, and question answers stay as saved. Speed stays editable. */
  choicesLocked?: boolean;
}

const EMPTY_SHORTLIST_KEY = "chooser.noMatches";

const entriesLabel = (entries: string | null, t: ReturnType<typeof useCustomerT>): string | null => {
  if (!entries) return null;
  const e = entries.toLowerCase();
  if (e.includes("multi")) return t("chooser.entryLabels.multiple");
  if (e.includes("single")) return t("chooser.entryLabels.single");
  return entries;
};

const compactFact = (value: string): string => value.toLowerCase().replace(/[\s\-–—·]/g, "");

/** Omit subtitle facts already spelled out in the product name (e.g. "14 Days - Single Entry"). */
export const serviceResultSubtitle = (
  name: string,
  durationDays: number | null,
  entryText: string | null,
  t: ReturnType<typeof useCustomerT>,
): string | null => {
  const normalizedName = compactFact(name);
  const parts: string[] = [];
  if (durationDays != null) {
    const dayLabel = t("chooser.durationDays", { count: durationDays });
    const dayFact = compactFact(dayLabel);
    if (!normalizedName.includes(dayFact)) {
      parts.push(dayLabel);
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
  testId: string;
}

const StayChoiceTile: FC<IStayChoiceTileProps> = ({ selected, label, hint, icon, onClick, testId }) => (
  <button
    type="button"
    data-testid={testId}
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
  testId: string;
}

const ChoiceButton: FC<IChoiceButtonProps> = ({ selected, label, hint, icon, onClick, testId }) => (
  <button
    type="button"
    data-testid={testId}
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
  showDateStep = false,
  travelDate = "",
  onTravelDateChange,
  todayUae = "",
  maxTravelDate = "",
  selectedVisaExtra = null,
  choicesLocked = false,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const skipPhaseScroll = useRef(true);
  const stayBuckets = useMemo(() => stayOptionsForChooser(services), [services]);
  const [phase, setPhase] = useState<TChooserPhase>(initialPhase);
  const [stay, setStay] = useState<TStayBucket | null>(initialStay);
  const [entry, setEntry] = useState<"single" | "multiple">(initialEntry);
  const [kind, setKind] = useState<TTravelerKind>(initialKind);

  const view = useMemo(() => {
    if (phase === "date" && !showDateStep) {
      return { phase: "results" as const, stay, entry, kind };
    }
    if (phase === "stay" && stayBuckets.length === 0) {
      return { phase: "results" as const, stay: null, entry, kind };
    }
    return { phase, stay, entry, kind };
  }, [phase, stay, entry, kind, stayBuckets, showDateStep]);

  useEffect(() => {
    onAnswersChange?.({ stay: view.stay, entry: view.entry, kind: view.kind });
  }, [view.stay, view.entry, view.kind, onAnswersChange]);

  useEffect(() => {
    onPhaseChange?.(view.phase);
  }, [view.phase, onPhaseChange]);

  useEffect(() => {
    if (skipPhaseScroll.current) {
      skipPhaseScroll.current = false;
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    root.scrollIntoView({ block: "start", behavior: "smooth" });
    const heading = root.querySelector("h3:not(.sr-only)");
    if (heading instanceof HTMLElement) {
      heading.focus({ preventScroll: true });
    }
  }, [view.phase]);

  const matches = useMemo(() => {
    if (!view.stay) return services.filter((s) => s.showInGuidedChooser);
    const ids = new Set(
      filterGuidedServices(services, { stay: view.stay, entry: view.entry, kind: view.kind }).map((s) => s.id),
    );
    return services.filter((s) => ids.has(s.id));
  }, [services, view.stay, view.entry, view.kind]);

  const afterQuestions = (phase: TChooserPhase): TChooserPhase =>
    phase === "results" && showDateStep ? "date" : phase;

  const chooseService = (id: string) => {
    if (choicesLocked) return;
    onSelectService(id);
  };

  const goStay = (next: TStayBucket) => {
    if (choicesLocked) return;
    const nextEntry = defaultEntryForStay(services, next);
    const nextKind = defaultKindForStay(services, next, nextEntry);
    setStay(next);
    setEntry(nextEntry);
    setKind(nextKind);
    chooseService("");
    setPhase(afterQuestions(nextPhaseAfterStay(services, next)));
  };

  const goEntry = (next: "single" | "multiple") => {
    if (choicesLocked) return;
    const stayForEntry = view.stay ?? "1_14";
    const nextKind = defaultKindForStay(services, stayForEntry, next);
    setStay(stayForEntry);
    setEntry(next);
    setKind(nextKind);
    chooseService("");
    setPhase(afterQuestions(nextPhaseAfterEntry(services, stayForEntry, next)));
  };

  const goKind = (next: TTravelerKind) => {
    if (choicesLocked) return;
    setKind(next);
    chooseService("");
    setPhase(showDateStep ? "date" : "results");
  };

  const backFromList = () => {
    if (showDateStep) return void setPhase("date");
    if (view.stay && nextPhaseAfterEntry(services, view.stay, view.entry) === "kind") {
      return void setPhase("kind");
    }
    if (view.stay && needsEntryQuestion(services, view.stay)) return void setPhase("entry");
    if (stayBuckets.length > 0) return void setPhase("stay");
  };

  const goBack = () => {
    if (choicesLocked) return;
    chooseService("");
    if (view.phase === "results") {
      backFromList();
      return;
    }
    if (view.phase === "date") {
      if (view.stay && nextPhaseAfterEntry(services, view.stay, view.entry) === "kind") {
        return void setPhase("kind");
      }
      if (view.stay && needsEntryQuestion(services, view.stay)) return void setPhase("entry");
      if (stayBuckets.length > 0) return void setPhase("stay");
      return;
    }
    if (view.phase === "kind") {
      if (view.stay && needsEntryQuestion(services, view.stay)) return void setPhase("entry");
      if (stayBuckets.length > 0) return void setPhase("stay");
      return;
    }
    if (view.phase === "entry" && stayBuckets.length > 0) setPhase("stay");
  };

  const showChooserBack =
    view.phase === "results" ||
    view.phase === "date" ||
    view.phase === "kind" ||
    (view.phase === "entry" && stayBuckets.length > 0);

  const entryChoices = view.stay ? entryOptionsForStay(services, view.stay) : [];
  const kindChoices = view.stay ? kindOptionsForStay(services, view.stay, view.entry) : [];

  return (
    <div
      ref={rootRef}
      className="scroll-mt-[var(--wp-shell-header-height,130px)] space-y-4 rounded-2xl border border-border/80 bg-muted/35 p-3 sm:p-5"
    >
      {showChooserBack && !choicesLocked ? (
        <button
          type="button"
          onClick={goBack}
          className="text-secondary hover:text-foreground inline-flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden /> {t("chooser.back")}
        </button>
      ) : null}
      <div key={view.phase} className="theme-client-rise space-y-4">
        {view.phase === "stay" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl">
              <h3 tabIndex={-1} className={`font-heading text-foreground text-center text-2xl font-semibold tracking-tight sm:text-3xl ${APPLY_PROGRAMMATIC_HEADING_CLASS}`}>
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
                    testId={`chooser-stay-${b}`}
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
              <h3 tabIndex={-1} className={`font-heading text-foreground text-center text-2xl font-semibold tracking-tight sm:text-3xl ${APPLY_PROGRAMMATIC_HEADING_CLASS}`}>
                {t("chooser.singleOrMultiple")}
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {entryChoices.map((choice) =>
                choice === "single" ? (
                  <ChoiceButton
                    key="single"
                    testId="chooser-entry-single"
                    selected={view.entry === "single"}
                    label={t("chooser.singleEntry")}
                    hint={t("chooser.singleEntryHint")}
                    icon={<Plane className="size-6" />}
                    onClick={() => goEntry("single")}
                  />
                ) : (
                  <ChoiceButton
                    key="multiple"
                    testId="chooser-entry-multiple"
                    selected={view.entry === "multiple"}
                    label={t("chooser.multipleEntry")}
                    hint={t("chooser.multipleEntryHint")}
                    icon={<Repeat2 className="size-6" />}
                    onClick={() => goEntry("multiple")}
                  />
                ),
              )}
            </div>
          </div>
        ) : null}
        {view.phase === "kind" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl">
              <h3 tabIndex={-1} className={`font-heading text-foreground text-center text-2xl font-semibold tracking-tight sm:text-3xl ${APPLY_PROGRAMMATIC_HEADING_CLASS}`}>
                {t("chooser.whoIsVisaFor")}
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {kindChoices.map((choice) =>
                choice === "adult" ? (
                  <ChoiceButton
                    key="adult"
                    testId="chooser-kind-adult"
                    selected={view.kind === "adult"}
                    label={t("chooser.adult")}
                    icon={<UserRound className="size-6" />}
                    onClick={() => goKind("adult")}
                  />
                ) : (
                  <ChoiceButton
                    key="child"
                    testId="chooser-kind-child"
                    selected={view.kind === "child"}
                    label={t("chooser.child")}
                    icon={<Baby className="size-6" />}
                    onClick={() => goKind("child")}
                  />
                ),
              )}
            </div>
          </div>
        ) : null}
        {view.phase === "date" && todayUae && maxTravelDate ? (
          <TravelDateStep
            value={travelDate}
            onChange={(next) => {
              if (choicesLocked) return;
              onTravelDateChange?.(next);
            }}
            todayUae={todayUae}
            maxTravelDate={maxTravelDate}
            readOnly={choicesLocked}
            onContinue={() => setPhase("results")}
            onSkip={() => {
              if (!choicesLocked) onTravelDateChange?.("");
              setPhase("results");
            }}
          />
        ) : view.phase === "date" ? (
          <div className="space-y-3" data-travel-date-step="">
            <p className="text-muted-foreground text-sm" role="status">
              {t("start.loading")}
            </p>
            <ClientButton
              type="button"
              brand="white"
              className="min-h-11"
              onClick={() => {
                if (!choicesLocked) onTravelDateChange?.("");
                setPhase("results");
              }}
            >
              {t("start.travelDate.notSure")}
            </ClientButton>
          </div>
        ) : null}
        {view.phase === "results" ? (
          matches.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed" role="status">
              {t(EMPTY_SHORTLIST_KEY)}
            </p>
          ) : (
            <div className="space-y-4">
              <h3 className="sr-only">
                {t("chooser.matchingVisasBanner", {
                  stay: view.stay ? t(`chooser.stayLabels.${view.stay}`) : "",
                  travellerKind:
                    view.kind === "child" ? t("chooser.travellerKindChild") : t("chooser.travellerKindAdult"),
                })}
              </h3>
              <ul className="space-y-3">
                {matches.map((s) => {
                  const price = formatPrice(s);
                  const entryText = entriesLabel(s.entries, t);
                  const subtitle = serviceResultSubtitle(s.name, s.durationDays, entryText, t);
                  const visaName = customerFacingServiceName(s.name, locale, t, {
                    durationDays: s.durationDays,
                    entries: s.entries,
                    travelerKind: s.travelerKind,
                  });
                  const selected = selectedServiceId === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        data-testid={`chooser-visa-${s.id}`}
                        onClick={() => chooseService(s.id)}
                        disabled={choicesLocked}
                        aria-pressed={selected}
                        className={cn(
                          "border-border bg-card relative flex w-full flex-wrap items-start gap-x-3 gap-y-2 rounded-2xl border-2 px-4 py-5 text-left shadow-[0_10px_28px_rgba(1,32,49,0.05)] transition-all hover:-translate-y-0.5 hover:border-secondary",
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
                        <span className="min-w-0 flex-1 basis-[12rem]">
                          <span
                            className={cn(
                              "text-foreground block min-w-0 break-words text-pretty text-base font-semibold leading-snug",
                              selected && "text-secondary",
                            )}
                          >
                            <bdi className="break-words" title={visaName}>
                              {visaName}
                            </bdi>
                          </span>
                          {subtitle ? (
                            <span className="text-muted-foreground mt-1 block text-xs">{subtitle}</span>
                          ) : null}
                        </span>
                        <span className="ms-auto shrink-0 text-right">
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
                      {selected && selectedVisaExtra ? <div className="mt-3">{selectedVisaExtra}</div> : null}
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
              data-testid="chooser-add-traveller"
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
