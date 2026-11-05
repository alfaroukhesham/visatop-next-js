import type { FC, ReactNode } from "react";
import { ApplyJumpAheadProvider } from "@/components/apply/apply-jump-ahead";
import { ApplyStepsRail } from "@/components/apply/apply-steps-rail";
import { cn } from "@/lib/utils";

interface IApplyTwoColumnProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
  phase?: "documents" | "details";
  applicationId?: string;
  /** In-flow visa/duration step. Trip-done must not link to marketing home. */
  tripHref?: string | null;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  hasSelectedVisa?: boolean;
  visaSummary?: ReactNode;
  /** Documents step: keep the passport slot above the order card on small screens. */
  contentFirstOnMobile?: boolean;
}

export const ApplyTwoColumn: FC<IApplyTwoColumnProps> = ({
  currentStep,
  phase,
  applicationId,
  tripHref = null,
  children,
  className,
  contentClassName,
  hasSelectedVisa = false,
  visaSummary,
  contentFirstOnMobile = false,
}) => {
  if (!hasSelectedVisa) {
    return <div className={cn("w-full", className)}>{children}</div>;
  }

  return (
    <ApplyJumpAheadProvider>
      <div className={cn("space-y-5", className)}>
        <ApplyStepsRail
          currentStep={currentStep}
          phase={phase}
          applicationId={applicationId}
          tripHref={tripHref}
        />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div
            className={cn(
              contentFirstOnMobile ? "order-1" : "order-2 lg:order-1",
              "min-w-0",
              contentClassName,
            )}
          >
            {children}
          </div>
          {visaSummary ? (
            <aside
              className={cn(
                contentFirstOnMobile ? "order-2" : "order-1 lg:order-2",
                "min-w-0 lg:sticky lg:top-24",
              )}
            >
              {visaSummary}
            </aside>
          ) : null}
        </div>
      </div>
    </ApplyJumpAheadProvider>
  );
};
