"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState, type FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { cn } from "@/lib/utils";
import { useApplyJumpAhead } from "./apply-jump-ahead";

const STEPS = [
  { id: "trip", labelKey: "steps.trip", shortKey: "steps.tripShort" },
  { id: "documents", labelKey: "steps.documents", shortKey: "steps.documentsShort" },
  { id: "details", labelKey: "steps.details", shortKey: "steps.detailsShort" },
  { id: "pay", labelKey: "steps.pay", shortKey: "steps.payShort" },
  { id: "finish", labelKey: "steps.finish", shortKey: "steps.finishShort" },
] as const;

type TRailPhase = "trip" | "documents" | "details" | "pay" | "finish";

interface IApplyStepsRailProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  /** Documents page only: details is its own bar segment. */
  phase?: "documents" | "details";
  applicationId?: string;
  /** Last trip-selection step inside the draft. Never marketing home. */
  tripHref?: string | null;
  className?: string;
}

const activeIndexFor = (currentStep: number, phase: "documents" | "details" | undefined): number => {
  if (currentStep <= 2) return 0;
  if (currentStep === 3) return phase === "details" ? 2 : 1;
  if (currentStep === 4) return 3;
  return 4;
};

const hrefForPhase = (
  phase: TRailPhase,
  applicationId: string | undefined,
  tripHref: string | null | undefined,
): string | null => {
  if (phase === "trip") return tripHref ?? null;
  if (!applicationId) return null;
  const id = encodeURIComponent(applicationId);
  if (phase === "documents") return `/apply/applications/${id}?screen=ready`;
  if (phase === "details") return `/apply/applications/${id}?screen=details`;
  if (phase === "pay") return `/apply/applications/${id}/payment`;
  return `/apply/applications/${id}/submitted`;
};

export const ApplyStepsRail: FC<IApplyStepsRailProps> = ({
  currentStep,
  phase,
  applicationId,
  tripHref = null,
  className,
}) => {
  const t = useCustomerT();
  const jump = useApplyJumpAhead();
  const [hintVisible, setHintVisible] = useState(false);
  const activeIndex = activeIndexFor(currentStep, phase);
  const currentLabel = t(STEPS[activeIndex]!.labelKey);

  const onUpcomingTap = () => {
    setHintVisible(true);
    jump.pulse();
  };

  return (
    <nav
      className={cn(
        "border-secondary/20 bg-card/95 rounded-2xl border px-3 py-2.5 shadow-[0_8px_24px_rgba(1,32,49,0.06)]",
        className,
      )}
      aria-label={t("steps.railAriaLabel")}
    >
      <p className="text-foreground mb-2 text-xs font-semibold">
        {t("steps.meta", { n: activeIndex + 1, label: currentLabel })}
      </p>
      <ol className="flex items-start justify-between gap-1">
        {STEPS.map((s, index) => {
          const state = index < activeIndex ? "completed" : index === activeIndex ? "active" : "future";
          const href = hrefForPhase(s.id, applicationId, tripHref);
          const fullLabel = t(s.labelKey);
          const shortLabel = t(s.shortKey);
          const marker = (
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                state === "completed" && "border-secondary bg-secondary text-white",
                state === "active" && "border-secondary bg-accent text-secondary ring-2 ring-secondary/15",
                state === "future" && "border-border bg-muted text-muted-foreground opacity-60",
              )}
              aria-hidden
            >
              {state === "completed" ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
          );
          const caption = (
            <span
              className={cn(
                "max-w-full truncate text-center text-[10px] font-bold leading-tight sm:text-[11px]",
                state === "future" ? "text-muted-foreground" : "text-secondary",
              )}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{fullLabel}</span>
            </span>
          );
          return (
            <li key={s.labelKey} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              {state === "completed" ? (
                href ? (
                  <Link
                    href={href}
                    className="flex min-h-11 min-w-11 flex-col items-center gap-1"
                    aria-label={t("steps.completedGoBack", { label: fullLabel })}
                  >
                    {marker}
                    {caption}
                  </Link>
                ) : (
                  <div className="flex min-h-11 flex-col items-center gap-1">
                    {marker}
                    {caption}
                  </div>
                )
              ) : null}
              {state === "active" ? (
                <div className="flex min-h-11 flex-col items-center gap-1" aria-current="step">
                  {marker}
                  {caption}
                </div>
              ) : null}
              {state === "future" ? (
                <button
                  type="button"
                  className="flex min-h-11 min-w-11 flex-col items-center gap-1"
                  aria-disabled="true"
                  aria-label={fullLabel}
                  onClick={onUpcomingTap}
                >
                  {marker}
                  {caption}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
      {hintVisible ? (
        <p
          className="border-secondary/20 bg-accent text-secondary mt-2 rounded-lg border px-2.5 py-2 text-xs leading-snug"
          role="status"
          aria-live="polite"
        >
          {t("wizard.jumpAheadHint")}
        </p>
      ) : null}
    </nav>
  );
};
