"use client";

import type { FC } from "react";
import type { TApplyPriceBadges } from "@/lib/apply/apply-config";

export interface IAllInPriceBadgesProps {
  badges: TApplyPriceBadges;
}

export const AllInPriceBadges: FC<IAllInPriceBadgesProps> = ({ badges }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="border-border bg-card text-foreground rounded-[12px] border px-3 py-1 text-xs font-semibold">
        {badges.allFeesIncluded}
      </span>
      <span className="border-border bg-card text-foreground rounded-[12px] border px-3 py-1 text-xs font-semibold">
        {badges.noHiddenCharges}
      </span>
    </div>
  );
};
