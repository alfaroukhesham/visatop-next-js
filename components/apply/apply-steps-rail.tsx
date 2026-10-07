"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { type FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "trip", labelKey: "steps.trip" },
  { id: "documents", labelKey: "steps.documents" },
  { id: "details", labelKey: "steps.details" },
  { id: "pay", labelKey: "steps.pay" },
  { id: "finish", labelKey: "steps.finish" },
] as const;

type TRailPhase = "trip" | "documents" | "details" | "pay" | "finish";

interface IApplyStepsRailProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  /** Documents page only: details is its own bar segment. */
  phase?: "documents" | "details";
  applicationId?: string;
  className?: string;
}

const activeIndexFor = (currentStep: number, phase: "documents" | "details" | undefined): number => {
  if (currentStep <= 2) return 0;
  if (currentStep === 3) return phase === "details" ? 2 : 1;
  if (currentStep === 4) return 3;
  return 4;
};

const hrefForPhase = (phase: TRailPhase, applicationId?: string): string | null => {
  if (phase === "trip") return "/";
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
  className,
}) => {
  const t = useCustomerT();
  const activeIndex = activeIndexFor(currentStep, phase);
  return (
    <nav
      className={cn(
        "border-secondary/20 bg-card/95 rounded-2xl border px-3 py-2.5 shadow-[0_8px_24px_rgba(1,32,49,0.06)]",
        className,
      )}
      aria-label={t("steps.railAriaLabel")}
    >
      <ol className="flex items-center justify-between gap-1 sm:gap-3">
        {STEPS.map((s, index) => {
          const state = index < activeIndex ? "completed" : index === activeIndex ? "active" : "future";
          const href = hrefForPhase(s.id, applicationId);
          const isLink = Boolean(href) && state !== "future";
          const labelText = t(s.labelKey);
          const marker = (
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors sm:size-7",
                state === "completed" && "border-secondary bg-secondary text-white",
                state === "active" && "border-secondary bg-accent text-secondary ring-2 ring-secondary/10",
                state === "future" && "border-border bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {state === "completed" ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
          );
          const label = (
            <span
              className={cn(
                "truncate text-[11px] font-bold sm:text-xs",
                state === "future" ? "text-muted-foreground" : "text-secondary",
              )}
            >
              {labelText}
            </span>
          );
          return (
            <li key={s.labelKey} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              {isLink ? (
                <Link
                  href={href!}
                  className="flex min-w-0 items-center gap-1.5 sm:gap-2"
                  aria-current={state === "active" ? "step" : undefined}
                >
                  {marker}
                  {label}
                </Link>
              ) : (
                <div
                  className="flex min-w-0 items-center gap-1.5 sm:gap-2"
                  aria-current={state === "active" ? "step" : undefined}
                >
                  {marker}
                  {label}
                </div>
              )}
              {index < STEPS.length - 1 ? (
                <span className="bg-border mx-0.5 h-px min-w-2 flex-1 sm:min-w-5" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
