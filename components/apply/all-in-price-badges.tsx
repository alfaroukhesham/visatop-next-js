"use client";

import type { FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { DEFAULT_APPLY_PRICE_BADGES, type TApplyPriceBadges } from "@/lib/apply/apply-config";

export interface IAllInPriceBadgesProps {
  badges: TApplyPriceBadges;
}

export const AllInPriceBadges: FC<IAllInPriceBadgesProps> = ({ badges }) => {
  const t = useCustomerT();
  const allFeesIncluded =
    badges.allFeesIncluded === DEFAULT_APPLY_PRICE_BADGES.allFeesIncluded
      ? t("payment.badges.allFeesIncluded")
      : badges.allFeesIncluded;
  const noHiddenCharges =
    badges.noHiddenCharges === DEFAULT_APPLY_PRICE_BADGES.noHiddenCharges
      ? t("payment.badges.noHiddenCharges")
      : badges.noHiddenCharges;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="border-border bg-card text-foreground rounded-[12px] border px-3 py-1 text-xs font-semibold">
        {allFeesIncluded}
      </span>
      <span className="border-border bg-card text-foreground rounded-[12px] border px-3 py-1 text-xs font-semibold">
        {noHiddenCharges}
      </span>
    </div>
  );
};
