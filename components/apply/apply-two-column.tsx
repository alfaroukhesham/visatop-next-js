import type { ReactNode } from "react";
import { ApplyStepsRail } from "@/components/apply/apply-steps-rail";
import { cn } from "@/lib/utils";

type ApplyTwoColumnProps = {
  currentStep: 1 | 2 | 3 | 4 | 5;
  applicationId?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  hasSelectedVisa?: boolean;
  visaSummary?: ReactNode;
};

export function ApplyTwoColumn({
  currentStep,
  applicationId,
  children,
  className,
  contentClassName,
  hasSelectedVisa = false,
  visaSummary,
}: ApplyTwoColumnProps) {
  if (!hasSelectedVisa) {
    return <div className={cn("w-full", className)}>{children}</div>;
  }

  return (
    <div className={cn("space-y-5", className)}>
      <ApplyStepsRail currentStep={currentStep} applicationId={applicationId} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className={cn("order-2 min-w-0 lg:order-1", contentClassName)}>{children}</div>
        {visaSummary ? <aside className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-24">{visaSummary}</aside> : null}
      </div>
    </div>
  );
}
