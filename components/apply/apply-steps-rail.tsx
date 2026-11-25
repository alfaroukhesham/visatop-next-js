"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { cn } from "@/lib/utils";
import { useApplyJumpAhead } from "./apply-jump-ahead";

const BASE_STEPS = [
  { id: "trip", labelKey: "steps.trip", shortKey: "steps.tripShort" },
  { id: "documents", labelKey: "steps.documents", shortKey: "steps.documentsShort" },
  { id: "details", labelKey: "steps.details", shortKey: "steps.detailsShort" },
] as const;

const EXTRAS_STEP = { id: "extras", labelKey: "steps.extras", shortKey: "steps.extrasShort" } as const;

const TAIL_STEPS = [
  { id: "pay", labelKey: "steps.pay", shortKey: "steps.payShort" },
  { id: "finish", labelKey: "steps.finish", shortKey: "steps.finishShort" },
] as const;

const stepsFor = (includeExtras: boolean) =>
  includeExtras ? [...BASE_STEPS, EXTRAS_STEP, ...TAIL_STEPS] : [...BASE_STEPS, ...TAIL_STEPS];

type TRailPhase = "trip" | "documents" | "details" | "extras" | "pay" | "finish";

interface IApplyStepsRailProps {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  /** Documents page: details is its own bar segment. Extras is its own segment when offered. */
  phase?: "documents" | "details" | "extras";
  /** Insurance is priced, so Extras sits between Details and Pay. */
  includeExtras?: boolean;
  applicationId?: string;
  /** Last trip-selection step inside the draft. Never marketing home. */
  tripHref?: string | null;
  /** Party member for completed Details back-nav (last traveller on Pay). */
  detailsTravellerId?: string | null;
  className?: string;
}

const activeIndexFor = (
  currentStep: number,
  phase: "documents" | "details" | "extras" | undefined,
  includeExtras: boolean,
): number => {
  if (currentStep <= 2) return 0;
  if (currentStep === 3) return phase === "details" ? 2 : 1;
  if (includeExtras) {
    if (phase === "extras" || currentStep === 4) return 3;
    if (currentStep === 5) return 4;
    return 5;
  }
  if (currentStep === 4) return 3;
  return 4;
};

const hrefForPhase = (
  phase: TRailPhase,
  applicationId: string | undefined,
  tripHref: string | null | undefined,
  detailsTravellerId?: string | null,
): string | null => {
  if (phase === "trip") return tripHref ?? null;
  if (!applicationId) return null;
  const id = encodeURIComponent(applicationId);
  if (phase === "documents") return `/apply/applications/${id}?screen=ready`;
  if (phase === "details") {
    const params = new URLSearchParams({ screen: "details" });
    const traveller = detailsTravellerId?.trim();
    if (traveller) params.set("traveller", traveller);
    return `/apply/applications/${id}?${params.toString()}`;
  }
  if (phase === "extras") return `/apply/applications/${id}/extras`;
  if (phase === "pay") return `/apply/applications/${id}/payment`;
  return `/apply/applications/${id}/submitted`;
};

export const ApplyStepsRail: FC<IApplyStepsRailProps> = ({
  currentStep,
  phase,
  includeExtras = false,
  applicationId,
  tripHref = null,
  detailsTravellerId = null,
  className,
}) => {
  const t = useCustomerT();
  const router = useRouter();
  const jump = useApplyJumpAhead();
  const [hintVisible, setHintVisible] = useState(false);
  const steps = stepsFor(includeExtras);
  const activeIndex = activeIndexFor(currentStep, phase, includeExtras);
  const currentLabel = t(steps[activeIndex]!.labelKey);

  const onUpcomingTap = () => {
    setHintVisible(true);
    jump.pulse();
  };

  const onCurrentTap = () => {
    setHintVisible(true);
  };

  const onHintTap = () => {
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
        {t("steps.meta", { n: activeIndex + 1, total: steps.length, label: currentLabel })}
      </p>
      <ol className="flex items-start justify-between gap-1">
        {steps.map((s, index) => {
          const state = index < activeIndex ? "completed" : index === activeIndex ? "active" : "future";
          const href = hrefForPhase(s.id, applicationId, tripHref, detailsTravellerId);
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
                  <button
                    type="button"
                    className="focus-visible:ring-secondary/40 flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2"
                    aria-label={t("steps.completedGoBack", { label: fullLabel })}
                    onClick={() => router.push(href)}
                  >
                    {marker}
                    {caption}
                  </button>
                ) : (
                  <div className="flex min-h-11 flex-col items-center gap-1">
                    {marker}
                    {caption}
                  </div>
                )
              ) : null}
              {state === "active" ? (
                <button
                  type="button"
                  className="flex min-h-11 flex-col items-center gap-1"
                  aria-current="step"
                  onClick={onCurrentTap}
                >
                  {marker}
                  {caption}
                </button>
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
        <button
          type="button"
          className="border-secondary/20 bg-accent text-secondary mt-2 w-full rounded-lg border px-2.5 py-2 text-start text-xs leading-snug"
          role="status"
          aria-live="polite"
          onClick={onHintTap}
        >
          {t("wizard.jumpAheadHint")}
        </button>
      ) : null}
    </nav>
  );
};
