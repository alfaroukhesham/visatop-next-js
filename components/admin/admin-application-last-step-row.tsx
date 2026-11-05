"use client";

import type { FC } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_LAST_STEP_LIVE_HINT,
  useAdminApplicationLastStep,
} from "@/components/admin/use-admin-application-last-step";
import type { TAdminLastStepView } from "@/lib/applications/application-last-step";

interface IAdminApplicationLastStepRowProps {
  applicationId: string;
  initial: TAdminLastStepView;
}

export const AdminApplicationLastStepRow: FC<IAdminApplicationLastStepRowProps> = ({
  applicationId,
  initial,
}) => {
  const { lastStep, fetching, refresh } = useAdminApplicationLastStep({
    applicationId,
    initial,
  });
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
          className="rounded-none"
          disabled={fetching}
          aria-label="Refresh"
          onClick={() => void refresh()}
        >
          {fetching ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
        </Button>
      </dd>
      {lastStep.secondary ? (
        <dd className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">
          {lastStep.secondary}
        </dd>
      ) : null}
      <p className="mt-0.5 text-xs text-muted-foreground">{ADMIN_LAST_STEP_LIVE_HINT}</p>
    </div>
  );
};
