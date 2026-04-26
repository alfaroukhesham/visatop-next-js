"use client";

import type { ClientApplicationTracking } from "@/lib/applications/user-facing-tracking";

type Props = {
  tracking: ClientApplicationTracking;
  /** When true, hides the headline/detail block (caller renders those). */
  stepsOnly?: boolean;
  className?: string;
};

function stepCircleClass(state: ClientApplicationTracking["steps"][0]["state"]) {
  if (state === "done") return "border-primary bg-primary text-primary-foreground";
  if (state === "current") return "border-secondary bg-secondary/15 text-secondary ring-2 ring-secondary/30";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function ApplicationClientTracking({ tracking, stepsOnly, className }: Props) {
  return (
    <div className={className}>
      {!stepsOnly ? (
        <div className="space-y-2">
          <p className="text-secondary text-xs font-semibold uppercase tracking-[0.2em]">Status</p>
          <h2 className="font-heading text-foreground text-xl font-semibold tracking-tight">{tracking.headline}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{tracking.detail}</p>
        </div>
      ) : null}

      <ol
        className={`${stepsOnly ? "" : "mt-6"} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4`}
        aria-label="Application progress"
      >
        {tracking.steps.map((step, i) => (
          <li key={step.key} className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-[11rem] sm:flex-col sm:items-center sm:gap-2">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${stepCircleClass(step.state)}`}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              {i + 1}
            </span>
            <span
              className={`text-sm font-medium leading-snug sm:text-center ${step.state === "upcoming" ? "text-muted-foreground" : "text-foreground"}`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
