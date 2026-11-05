"use client";

import { useId, useState, type FC } from "react";
import { Camera, ChevronDown, FileText, Landmark } from "lucide-react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { cn } from "@/lib/utils";

export type TReadyDocumentIcon = "passport" | "photo" | "bank" | "file";

export type TReadyDocumentRow = {
  key: string;
  label: string;
  description: string;
  icon: TReadyDocumentIcon;
  tip?: string | null;
};

interface IReadyDocumentAccordionProps {
  neededNow: TReadyDocumentRow[];
  addLater: TReadyDocumentRow[];
}

const RowIcon: FC<{ icon: TReadyDocumentIcon }> = ({ icon }) => {
  if (icon === "photo") return <Camera className="size-5" aria-hidden />;
  if (icon === "bank") return <Landmark className="size-5" aria-hidden />;
  return <FileText className="size-5" aria-hidden />;
};

const iconClass = (icon: TReadyDocumentIcon) =>
  icon === "photo" ? "bg-accent text-secondary" : "bg-primary/20 text-secondary";

interface IAccordionItemProps {
  row: TReadyDocumentRow;
  open: boolean;
  onToggle: () => void;
}

const AccordionItem: FC<IAccordionItemProps> = ({ row, open, onToggle }) => {
  const t = useCustomerT();
  const panelId = useId();
  const buttonId = useId();
  const a11y = open
    ? t("wizard.docHideDetails", { name: row.label })
    : t("wizard.docShowDetails", { name: row.label });
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border">
      <button
        type="button"
        id={buttonId}
        className="flex min-h-11 w-full items-center gap-3 px-3.5 py-3 text-start"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={a11y}
        onClick={onToggle}
      >
        <span
          className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", iconClass(row.icon))}
          aria-hidden
        >
          <RowIcon icon={row.icon} />
        </span>
        <span className="text-foreground min-w-0 flex-1 text-sm font-semibold leading-snug">{row.label}</span>
        <ChevronDown
          className={cn(
            "text-muted-foreground size-5 shrink-0 rtl:-scale-x-100",
            open && "rotate-180 rtl:-scale-x-100",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={buttonId} className="text-muted-foreground px-3.5 pb-3 ps-14 text-xs leading-relaxed">
          <p>{row.description}</p>
          {row.tip ? <p className="mt-1">{row.tip}</p> : null}
        </div>
      ) : null}
    </div>
  );
};

export const ReadyDocumentAccordion: FC<IReadyDocumentAccordionProps> = ({ neededNow, addLater }) => {
  const t = useCustomerT();
  const firstKey = neededNow[0]?.key ?? addLater[0]?.key ?? null;
  const [openKey, setOpenKey] = useState<string | null>(firstKey);
  const toggle = (key: string) => {
    setOpenKey((current) => (current === key ? null : key));
  };
  return (
    <div className="space-y-3" data-apply-ready-docs="">
      {neededNow.length > 0 ? (
        <div className="space-y-2">
          <p className="text-foreground text-xs font-bold uppercase tracking-wide">{t("wizard.neededNow")}</p>
          {neededNow.map((row) => (
            <AccordionItem key={row.key} row={row} open={openKey === row.key} onToggle={() => toggle(row.key)} />
          ))}
        </div>
      ) : null}
      {addLater.length > 0 ? (
        <div className="space-y-2">
          <p className="text-foreground text-xs font-bold uppercase tracking-wide">{t("wizard.addLater")}</p>
          {addLater.map((row) => (
            <AccordionItem key={row.key} row={row} open={openKey === row.key} onToggle={() => toggle(row.key)} />
          ))}
        </div>
      ) : null}
    </div>
  );
};
