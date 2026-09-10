"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { cn } from "@/lib/utils";

type ApplyJourneyStepBarProps = { step: number; totalSteps: number; title: string; subtitle: string; className?: string; actions?: React.ReactNode };

export function ApplyJourneyStepBar({ step, totalSteps, title, subtitle, className, actions }: ApplyJourneyStepBarProps) {
  const t = useCustomerT();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return <div className={cn("mx-auto mb-6 flex w-[calc(100%-2rem)] max-w-3xl items-center gap-3 rounded-2xl border border-secondary/20 bg-card px-4 py-3 shadow-[0_10px_30px_rgba(1,32,49,0.07)]", className)}>
    <span className="bg-secondary text-white shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:text-xs">{t("steps.stepBadge", { step, total: totalSteps })}</span>
    <div className="min-w-0 flex-1"><p className="text-foreground truncate text-sm font-semibold sm:text-base">{title}</p><p className="text-muted-foreground hidden truncate text-xs sm:block sm:text-sm">{subtitle}</p></div>
    {actions ? <div className="shrink-0">{actions}</div> : null}
    <button type="button" onClick={() => setHidden(true)} className="border-border text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-full border" aria-label={t("steps.hideProgressAria")}><X className="size-4" aria-hidden /></button>
  </div>;
}
