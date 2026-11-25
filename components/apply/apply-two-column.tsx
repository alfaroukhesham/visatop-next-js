import type { FC, ReactNode } from "react";
import { ApplyJumpAheadProvider } from "@/components/apply/apply-jump-ahead";
import { ApplyStepsRail } from "@/components/apply/apply-steps-rail";
import { cn } from "@/lib/utils";

interface IApplyTwoColumnProps {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  phase?: "documents" | "details" | "extras";
  includeExtras?: boolean;
  /** Extras: the aside total only shows from 1025px, so mobile has one total. */
  summaryFrom?: "always" | "desktop";
  applicationId?: string;
  /** In-flow visa/duration step. Trip-done must not link to marketing home. */
  tripHref?: string | null;
  detailsTravellerId?: string | null;
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
  includeExtras = false,
  summaryFrom = "always",
  applicationId,
  tripHref = null,
  detailsTravellerId = null,
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
          includeExtras={includeExtras}
          applicationId={applicationId}
          tripHref={tripHref}
          detailsTravellerId={detailsTravellerId}
        />
        <div
          className={cn(
            "grid items-start gap-6",
            summaryFrom === "desktop"
              ? "min-[1025px]:grid-cols-[minmax(0,1fr)_280px]"
              : "lg:grid-cols-[minmax(0,1fr)_280px]",
          )}
        >
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
                summaryFrom === "desktop" && "hidden min-[1025px]:sticky min-[1025px]:top-24 min-[1025px]:block",
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
