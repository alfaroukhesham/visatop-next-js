"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ApplyJourneyStepBarProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  className?: string;
  /** Extra controls before the close button (e.g. primary CTA). */
  actions?: React.ReactNode;
};

export function ApplyJourneyStepBar({
  step,
  totalSteps,
  title,
  subtitle,
  className,
  actions,
}: ApplyJourneyStepBarProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div
      className={cn(
        "border-secondary/40 bg-card/95 supports-[backdrop-filter]:bg-card/88 fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 items-center gap-3 rounded-[14px] border-2 px-3 py-2.5 shadow-[0_16px_48px_rgba(1,32,49,0.18)] backdrop-blur-md sm:px-4 sm:py-3",
        className,
      )}
    >
      <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:text-xs">
        Step {step}/{totalSteps}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-semibold sm:text-base">{title}</p>
        <p className="text-muted-foreground hidden truncate text-xs sm:block sm:text-sm">{subtitle}</p>
      </div>
      {actions ? <div className="hidden shrink-0 sm:block">{actions}</div> : null}
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="border-border text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-full border"
        aria-label="Hide progress bar"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
