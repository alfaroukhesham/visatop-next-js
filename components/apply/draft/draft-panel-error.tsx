"use client";

import type { FC } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";

export interface IDraftPanelErrorProps {
  error: string | null;
  onRetry: () => void;
}

export const DraftPanelError: FC<IDraftPanelErrorProps> = ({ error, onRetry }) => {
  const t = useCustomerT();
  return (
    <div className="space-y-4 rounded-[12px] border border-border bg-card p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <p className="text-error text-sm leading-relaxed">{error ?? t("draft.notFound")}</p>
      <p className="text-muted-foreground text-sm">
        {t("draft.guestSessionHint")}{" "}
        <Link href="/apply/track" className="text-link font-medium hover:underline">
          {t("draft.lookUpStatusLink")}
        </Link>
        .
      </p>
      <ClientButton type="button" variant="outline" className="rounded-none" onClick={onRetry}>
        <RefreshCw className="mr-2 size-4" aria-hidden />
        {t("draft.retry")}
      </ClientButton>
      <Link href="/" className="text-link ml-4 text-sm font-medium">
        {t("draft.startOver")}
      </Link>
    </div>
  );
};
