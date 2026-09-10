"use client";

import type { FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import type { TPublicPartyMember } from "@/lib/applications/load-party-members";

export interface IPartyDocumentsTabsProps {
  members: TPublicPartyMember[];
  selectedMemberId: string;
  onSelect: (memberId: string) => void;
}

export const PartyDocumentsTabs: FC<IPartyDocumentsTabsProps> = ({
  members,
  selectedMemberId,
  onSelect,
}) => {
  const t = useCustomerT();
  if (members.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label={t("draft.partyTabsLabel")}
      className="flex flex-wrap gap-2 rounded-[12px] border border-border bg-card p-2"
    >
      {members.map((m) => {
        const active = m.applicationId === selectedMemberId;
        const label =
          m.travelerRole === "primary"
            ? t("draft.primaryTraveller")
            : t("draft.travellerNumber", { number: m.travelerIndex });
        const kind = m.travelerKind === "child" ? t("start.party.child") : t("start.party.adult");
        return (
          <button
            key={m.applicationId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(m.applicationId)}
            className={
              "flex flex-col items-start gap-0.5 rounded-[8px] px-3 py-2 text-left text-sm transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted")
            }
          >
            <span className="font-medium">{label}</span>
            <span className={active ? "text-primary-foreground/80 text-xs" : "text-muted-foreground text-xs"}>
              {kind} · {m.serviceName}
            </span>
          </button>
        );
      })}
    </div>
  );
};
