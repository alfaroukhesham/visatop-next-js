"use client";

import { useEffect, useMemo, useState, type FC } from "react";
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
  onAnswersChange?: (answers: {
    stay: TStayBucket | null;
    entry: "single" | "multiple";
    kind: TTravelerKind;
  }) => void;
}

const EMPTY_SHORTLIST = "No visa matches these answers. Change your answers or contact us.";

const entriesLabel = (entries: string | null): string | null => {
  if (!entries) return null;
  const e = entries.toLowerCase();
  if (e.includes("multi")) return "Multiple entry";
  if (e.includes("single")) return "Single entry";
  return entries;
};

interface IChoiceButtonProps {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}

const ChoiceButton: FC<IChoiceButtonProps> = ({ selected, label, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "border-border bg-card min-h-14 w-full rounded-[12px] border-2 px-4 py-4 text-left transition-colors",
      selected ? "border-primary bg-accent/25" : "hover:border-secondary",
    )}
  >
    <span className="text-foreground block text-base font-semibold">{label}</span>
    {hint ? <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">{hint}</span> : null}
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
}) => {
  const stayBuckets = useMemo(() => stayOptionsForChooser(services), [services]);
  const [phase, setPhase] = useState<TChooserPhase>("stay");
  const [stay, setStay] = useState<TStayBucket | null>(null);
  const [entry, setEntry] = useState<"single" | "multiple">("single");
  const [kind, setKind] = useState<TTravelerKind>("adult");

  useEffect(() => {
    onAnswersChange?.({ stay, entry, kind });
  }, [stay, entry, kind, onAnswersChange]);

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
      if (stay && nextPhaseAfterEntry(services, stay) === "kind") {
        setPhase("kind");
        return;
      }
      if (stay && needsEntryQuestion(services, stay)) {
        setPhase("entry");
        return;
      }
      setPhase("stay");
      return;
    }
    if (phase === "kind") {
      if (stay && needsEntryQuestion(services, stay)) {
        setPhase("entry");
        return;
      }
      setPhase("stay");
      return;
    }
    if (phase === "entry") setPhase("stay");
  };

  return (
    <div className="space-y-6">
      {phase !== "stay" ? (
        <button
          type="button"
          onClick={goBack}
          className="text-secondary hover:text-foreground text-sm font-semibold"
        >
          ← Back
        </button>
      ) : null}

      {phase !== "results" ? (
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
          Question {questionIndex} of {totalQuestions}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">Your matching visas</p>
      )}

      {phase === "stay" ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-heading text-foreground text-xl font-semibold tracking-tight text-balance">
              How long will you stay?
            </h3>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Pick the stay that matches your trip. We only show visas that fit this answer.
            </p>
          </div>
          <div className="grid gap-3">
            {stayBuckets.map((b) => (
              <ChoiceButton
                key={b}
                selected={stay === b}
                label={APPLY_STAY_LABELS[b]}
                onClick={() => goStay(b)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {phase === "entry" ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-heading text-foreground text-xl font-semibold tracking-tight text-balance">
              Single or multiple entry?
            </h3>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Single entry is one arrival. Multiple entry lets you leave and return during the visa.
            </p>
          </div>
          <div className="grid gap-3">
            <ChoiceButton
              selected={entry === "single"}
              label="Single entry"
              hint="One arrival into the country"
              onClick={() => goEntry("single")}
            />
            <ChoiceButton
              selected={entry === "multiple"}
              label="Multiple entry"
              hint="Leave and return while the visa is valid"
              onClick={() => goEntry("multiple")}
            />
          </div>
        </div>
      ) : null}

      {phase === "kind" ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-heading text-foreground text-xl font-semibold tracking-tight text-balance">
              Who is this visa for?
            </h3>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Some stays have a separate child visa. You can add more travellers after you pick a visa.
            </p>
          </div>
          <div className="grid gap-3">
            <ChoiceButton selected={kind === "adult"} label="Adult" onClick={() => goKind("adult")} />
            <ChoiceButton selected={kind === "child"} label="Child" onClick={() => goKind("child")} />
          </div>
        </div>
      ) : null}

      {phase === "results" ? (
        matches.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed" role="status">
            {EMPTY_SHORTLIST}
          </p>
        ) : (
          <ul className="space-y-3">
            {matches.map((s) => {
              const price = formatPrice(s);
              const entryText = entriesLabel(s.entries);
              const selected = selectedServiceId === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectService(s.id)}
                    className={cn(
                      "border-border bg-card flex w-full items-center gap-4 rounded-[12px] border-2 px-4 py-4 text-left transition-colors",
                      selected ? "border-primary bg-accent/25" : "hover:border-secondary",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block text-sm font-semibold leading-snug">{s.name}</span>
                      {entryText || s.durationDays != null ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {[s.durationDays != null ? `${s.durationDays} days` : null, entryText]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
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
        )
      ) : null}

      {phase === "results" && matches.length > 0 && partyEnabled ? (
        <div className="border-border bg-card space-y-3 rounded-[12px] border-2 px-4 py-4">
          <p className="text-foreground text-sm font-semibold">Travelling with others?</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {selectedServiceId
              ? "Add another traveller to this checkout. Each person can have a different visa."
              : "Select a visa above, then add more travellers to this checkout."}
          </p>
          <button
            type="button"
            onClick={() => onAddTraveler?.()}
            disabled={!selectedServiceId || !canAddTraveler}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-[5px] border-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add traveller
          </button>
        </div>
      ) : null}
    </div>
  );
};
