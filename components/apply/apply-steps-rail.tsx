"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { type FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { cn } from "@/lib/utils";

const STEPS = [
  { step: 2, labelKey: "steps.visa" },
  { step: 3, labelKey: "steps.documents" },
  { step: 4, labelKey: "steps.payment" },
  { step: 5, labelKey: "steps.status" },
] as const;

interface IApplyStepsRailProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  applicationId?: string;
  className?: string;
}

const hrefForStep = (step: number, applicationId?: string): string | null => {
  if (step <= 2) return "/";
  if (!applicationId) return null;
  if (step === 3) return `/apply/applications/${encodeURIComponent(applicationId)}`;
  if (step === 4) return `/apply/applications/${encodeURIComponent(applicationId)}/payment`;
  if (step === 5) return `/apply/applications/${encodeURIComponent(applicationId)}/submitted`;
  return null;
};

const stepState = (step: number, currentStep: number): "completed" | "active" | "future" => {
  if (step < currentStep) return "completed";
  if (step === currentStep || (currentStep === 1 && step === 2)) return "active";
  return "future";
};

export const ApplyStepsRail: FC<IApplyStepsRailProps> = ({ currentStep, applicationId, className }) => {
  const t = useCustomerT();
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
          const state = stepState(s.step, currentStep);
          const href = hrefForStep(s.step, applicationId);
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
