"use client";

import type { FC, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";
import type { TSpeedNote } from "@/lib/apply/checkout-extras-ui";
import { cn } from "@/lib/utils";

interface IVisaSpeedChoiceProps {
  fastTrackAvailable: boolean;
  selected: "standard" | "fast_track";
  recommend: boolean;
  note: TSpeedNote | null;
  relative: string;
  unitText: string | null;
  sumText: string | null;
  onSelect: (speed: "standard" | "fast_track") => void;
}

const caution = (body: ReactNode) => (
  <div className="border-primary bg-primary/15 text-foreground flex items-start gap-2 rounded-[12px] border p-3 text-sm">
    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
    <div className="space-y-1">{body}</div>
  </div>
);

export const VisaSpeedChoice: FC<IVisaSpeedChoiceProps> = ({
  fastTrackAvailable,
  selected,
  recommend,
  note,
  relative,
  unitText,
  sumText,
  onSelect,
}) => {
  const t = useCustomerT();
  const noteBody = () => {
    if (!note || (note !== "n2" && note !== "n3" && note !== "n4")) return null;
    if (note === "n2") {
      return caution(
        <>
          <p>{t("extras.notes.n2", { relative })}</p>
          <button
            type="button"
            className="text-secondary min-h-11 underline"
            onClick={() => onSelect("fast_track")}
          >
            {t("extras.notes.n2Action")}
          </button>
        </>,
      );
    }
    const template = t(`extras.notes.${note}`, { relative });
    const [before, after] = template.split("{whatsapp}");
    return caution(
      <p>
        {before ?? template}
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary underline"
        >
          {t("payment.whatsappHelpLink")}
        </a>
        {after ?? ""}
      </p>,
    );
  };

  if (!fastTrackAvailable) return noteBody();

  const card = (speed: "standard" | "fast_track", title: string, promise: string, price: string) => {
    const active = selected === speed;
    return (
      <label
        className={cn(
          "flex min-h-[72px] cursor-pointer flex-col gap-2 rounded-[12px] border-2 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:!outline-secondary",
          active ? "border-secondary bg-accent/70 ring-2 ring-secondary/10" : "border-border bg-card hover:border-secondary/40",
        )}
      >
        <input
          type="radio"
          name="visa-processing-speed"
          className="sr-only"
          value={speed}
          checked={active}
          onChange={() => onSelect(speed)}
        />
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                active ? "border-secondary" : "border-muted-foreground",
              )}
              aria-hidden
            >
              {active ? <span className="size-2.5 rounded-full bg-secondary" /> : null}
            </span>
            <span className="text-foreground text-base font-semibold">{title}</span>
          </span>
          <span className="ms-auto flex flex-col items-end gap-1 text-end">
            {speed === "fast_track" && recommend ? <Badge variant="default">{t("extras.speed.badge")}</Badge> : null}
            <span className="font-heading text-foreground font-bold tabular-nums">
              <bdi>{price}</bdi>
            </span>
          </span>
        </span>
        <span className="text-muted-foreground ps-8 text-sm">{promise}</span>
        {speed === "fast_track" && sumText ? (
          <span className="text-muted-foreground ps-8 text-xs">
            <bdi>{sumText}</bdi>
          </span>
        ) : null}
      </label>
    );
  };

  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-foreground mb-2 text-sm font-semibold">{t("extras.speed.legend")}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {card("standard", t("extras.speed.standard.title"), t("extras.speed.standard.promise"), t("extras.speed.standard.price"))}
        {card("fast_track", t("extras.speed.fast.title"), t("extras.speed.fast.promiseDefault"), unitText ?? t("extras.speed.fast.price", { price: "" }))}
      </div>
      {noteBody()}
    </fieldset>
  );
};
