"use client";

import type { FC, ReactNode } from "react";
import { useId } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_LAST_STEP_LIVE_HINT,
  formatAdminLastStepStaleCue,
  useAdminApplicationLastStep,
} from "@/components/admin/use-admin-application-last-step";
import type { TAdminLastStepView } from "@/lib/applications/application-last-step";

interface IAdminApplicationLastStepRowProps {
  lastStep: TAdminLastStepView;
  fetching: boolean;
  hintId: string;
  onRefresh: () => void;
}

export const AdminApplicationLastStepRow: FC<IAdminApplicationLastStepRowProps> = ({
  lastStep,
  fetching,
  hintId,
  onRefresh,
}) => {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {lastStep.fieldLabel}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1 text-sm text-foreground">
        <span className="min-w-0">{lastStep.value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="rounded-none size-5"
          disabled={fetching}
          aria-label="Refresh"
          aria-describedby={hintId}
          onClick={onRefresh}
        >
          {fetching ? (
            <Loader2 className="size-3 motion-safe:animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
        </Button>
      </dd>
    </div>
  );
};

interface IAdminApplicationLastStepLiveProps {
  applicationId: string;
  initial: TAdminLastStepView;
  children: ReactNode;
}

export const AdminApplicationLastStepLive: FC<IAdminApplicationLastStepLiveProps> = ({
  applicationId,
  initial,
  children,
}) => {
  const hintId = useId();
  const { lastStep, fetching, refresh, stale, lastSuccessAt } = useAdminApplicationLastStep({
    applicationId,
    initial,
  });
  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 border-t border-border pt-4">
        {children}
        <AdminApplicationLastStepRow
          lastStep={lastStep}
          fetching={fetching}
          hintId={hintId}
          onRefresh={() => void refresh()}
        />
      </dl>
      <p id={hintId} className="mt-2 text-xs text-muted-foreground">
        {ADMIN_LAST_STEP_LIVE_HINT}
        {stale ? <span> {formatAdminLastStepStaleCue(lastSuccessAt)}</span> : null}
      </p>
    </div>
  );
};
