import type { ReactNode } from "react";
import { ApplyStepsRail } from "@/components/apply/apply-steps-rail";
import { cn } from "@/lib/utils";

type ApplyTwoColumnProps = {
  currentStep: 1 | 2 | 3 | 4 | 5;
  applicationId?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ApplyTwoColumn({
  currentStep,
  applicationId,
  children,
  className,
  contentClassName,
}: ApplyTwoColumnProps) {
  return (
    <div className={cn("grid gap-10 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start", className)}>
      <aside className="hidden lg:block">
        <div className="lg:sticky lg:top-28">
          <ApplyStepsRail currentStep={currentStep} applicationId={applicationId} />
        </div>
      </aside>
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
    </div>
  );
}

