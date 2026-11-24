"use client";

import { useEffect, useRef, useState, type FC } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClientButton } from "@/components/client/client-button";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { SUPPORT_WHATSAPP_URL } from "@/lib/support-contact";
import { cn } from "@/lib/utils";
import { ArrivalDateField } from "@/components/apply/arrival-date-field";
import {
  extraByKey,
  formatArrivalDate,
  formatMinorAmount,
  insuredApplicationIds,
  localizedExtraCopy,
  pluralMessage,
  relativeArrivalLabel,
  speedUi,
  type TClientQuotePreview,
  type TProcessingSpeedChoice,
  type TSpeedNote,
  type TTranslate,
} from "@/lib/apply/checkout-extras-ui";

interface ITripExtrasPanelProps {
  preview: TClientQuotePreview;
  locked: boolean;
  /** True from the moment Proceed to payment is clicked until it fails or is cancelled. */
  paying: boolean;
  switchedBack: boolean;
  announceNote: boolean;
  updateError: string | null;
  onSpeed: (speed: TProcessingSpeedChoice) => void;
  onInsurance: (applicationId: string, selected: boolean) => void;
  onInsuranceAll: (selected: boolean) => void;
  onSaveDate: (travelDate: string | null) => Promise<boolean> | boolean;
  onRetry: () => void;
  onCancelCheckout: () => void;
  onDateBlocksPay: (blocked: boolean) => void;
  showDate?: boolean;
  showInsurance?: boolean;
}

const noteClass = (note: TSpeedNote): string =>
  note === "n1" || note === "n5" || note === "soon"
    ? "border-secondary/30 bg-accent text-foreground"
    : "border-primary bg-primary/15 text-foreground";

const NoteIcon: FC<{ note: TSpeedNote }> = ({ note }) =>
  note === "n1" || note === "n5" || note === "soon" ? (
    <Info className="text-secondary mt-0.5 size-4 shrink-0" aria-hidden />
  ) : (
    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
  );

const withWhatsApp = (template: string, linkLabel: string) => {
  const [before, after] = template.split("{whatsapp}");
  return { before: before ?? template, after: after ?? "", linkLabel };
};

interface ISpeedCardProps {
  title: string;
  promise: string;
  price: string;
  sum: string | null;
  selected: boolean;
  value: TProcessingSpeedChoice;
  badge: string | null;
  disabled: boolean;
  onSelect: (speed: TProcessingSpeedChoice) => void;
}

const SpeedCard: FC<ISpeedCardProps> = ({
  title,
  promise,
  price,
  sum,
  selected,
  value,
  badge,
  disabled,
  onSelect,
}) => (
  <label
    className={cn(
      "flex min-h-[72px] cursor-pointer flex-col gap-2 rounded-[12px] border-2 p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-secondary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:!outline-secondary has-[:focus-visible]:outline-offset-2",
      selected ? "border-secondary bg-accent/70 ring-2 ring-secondary/10" : "border-border bg-card hover:border-secondary/40",
      disabled && "cursor-not-allowed",
    )}
  >
    <input
      type="radio"
      id={`processing-speed-${value}`}
      name="processing-speed"
      className="sr-only focus-visible:!outline-secondary"
      value={value}
      checked={selected}
      disabled={disabled}
      onChange={() => onSelect(value)}
    />
    <span className="flex flex-wrap items-start justify-between gap-2">
      <span className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
            selected ? "border-secondary" : "border-muted-foreground",
          )}
          aria-hidden
        >
          {selected ? <span className="size-2.5 rounded-full bg-secondary" /> : null}
        </span>
        <span className="text-foreground text-base font-semibold">{title}</span>
      </span>
      <span className="ms-auto flex flex-col items-end gap-1 text-end">
        {badge ? <Badge variant="default">{badge}</Badge> : null}
        <span className="font-heading text-foreground font-bold tabular-nums">
          <bdi>{price}</bdi>
        </span>
      </span>
    </span>
    <span className="text-muted-foreground ps-8 text-sm">{promise}</span>
    {sum ? (
      <span className="text-muted-foreground ps-8 text-xs">
        <bdi>{sum}</bdi>
      </span>
    ) : null}
  </label>
);

export const TripExtrasPanel: FC<ITripExtrasPanelProps> = ({
  preview,
  locked,
  paying,
  switchedBack,
  announceNote,
  updateError,
  onSpeed,
  onInsurance,
  onInsuranceAll,
  onSaveDate,
  onRetry,
  onCancelCheckout,
  onDateBlocksPay,
  showDate = true,
  showInsurance = true,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const fastTrack = extraByKey(preview, "fast_track");
  const insurance = extraByKey(preview, "travel_insurance");
  const ui = speedUi({ preview, fastTrackAvailable: Boolean(fastTrack), switchedBack });
  const [editing, setEditing] = useState(!preview.travelDate);
  const [draft, setDraft] = useState(preview.travelDate ?? "");
  const [dateError, setDateError] = useState<string | null>(
    preview.travelDateRequired && !preview.travelDate ? t("start.travelDate.errorEmpty") : null,
  );
  const [touched, setTouched] = useState(Boolean(preview.travelDateRequired && !preview.travelDate));
  const changeRef = useRef<HTMLButtonElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const pendingSpeedFocus = useRef<TProcessingSpeedChoice | null>(null);
  const controlsDisabled = locked || paying;
  const insuredIds = insuredApplicationIds(preview);
  const memberIds = preview.visaLines.map((line) => line.applicationId);
  const allInsured = memberIds.length > 0 && insuredIds.length === memberIds.length;
  const someInsured = insuredIds.length > 0 && !allInsured;
  const money = (minor: string) => formatMinorAmount(minor, preview.currency, locale, "code");
  const relative =
    preview.daysUntilTravel === null
      ? ""
      : relativeArrivalLabel(locale, preview.daysUntilTravel, t);
  const travellersWord = (count: number) =>
    pluralMessage(t, "extras.travellers", locale, count);
  const sumLine = (unitMinor: string, count: number, sumMinor: string): string | null => {
    if (count <= 1) return null;
    return t("extras.perTravellerSum", {
      price: money(unitMinor),
      n: count,
      travellersWord: travellersWord(count),
      sum: money(sumMinor),
    });
  };

  const draftValue = draft.trim() || null;
  const dateBlocks =
    showDate &&
    !locked &&
    (Boolean(dateError) ||
      (preview.travelDateRequired && !preview.travelDate) ||
      (editing && draftValue !== preview.travelDate));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someInsured;
  }, [someInsured]);

  useEffect(() => {
    const speed = pendingSpeedFocus.current;
    if (!speed) return;
    pendingSpeedFocus.current = null;
    document.getElementById(`processing-speed-${speed}`)?.focus();
  }, [ui.selected]);

  const selectSpeed = (speed: TProcessingSpeedChoice) => {
    pendingSpeedFocus.current = speed;
    onSpeed(speed);
  };

  useEffect(() => {
    onDateBlocksPay(dateBlocks);
  }, [dateBlocks, onDateBlocksPay]);

  useEffect(() => () => onDateBlocksPay(false), [onDateBlocksPay]);

  const saveDate = async () => {
    if (dateError) return;
    const next = draft.trim();
    if (!next && preview.travelDateRequired) {
      setDateError(t("start.travelDate.errorEmpty"));
      setTouched(true);
      return;
    }
    const saved = await onSaveDate(next || null);
    if (!saved) return;
    setEditing(false);
    window.setTimeout(() => changeRef.current?.focus(), 0);
  };

  return (
    <section aria-labelledby="trip-extras-title" className="space-y-4" data-testid="trip-extras">
      <h2
        id="trip-extras-title"
        className="font-heading text-foreground text-base! font-semibold md:text-lg!"
      >
        {t("extras.sectionTitle")}
      </h2>

      {showDate ? (
      <div className="rounded-[12px] border border-border bg-card p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-5">
        {editing && !locked ? (
          <div className="space-y-3">
            <ArrivalDateField
              id="trip-arrival-date"
              value={draft}
              onChange={setDraft}
              todayUae={preview.todayUae}
              maxTravelDate={preview.maxTravelDate}
              required={preview.travelDateRequired}
              error={dateError}
              onError={setDateError}
              touched={touched}
              onTouched={() => setTouched(true)}
            />
            <div className="flex flex-wrap gap-2">
              <ClientButton type="button" brand="blue" className="h-11 min-w-0 px-4" onClick={saveDate}>
                {t("extras.saveDate")}
              </ClientButton>
              {preview.travelDate ? (
                <ClientButton
                  type="button"
                  brand="white"
                  className="h-11 min-w-0 px-4"
                  onClick={() => {
                    setDraft(preview.travelDate ?? "");
                    setDateError(null);
                    setEditing(false);
                  }}
                >
                  {t("extras.cancel")}
                </ClientButton>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs">{t("extras.arrivalLabel")}</p>
              <p className="text-foreground text-sm font-medium">
                <bdi>
                  {preview.travelDate
                    ? t("start.travelDate.readback", {
                        date: formatArrivalDate(preview.travelDate, locale),
                        relative,
                      })
                    : t("start.travelDate.errorEmpty")}
                </bdi>
              </p>
            </div>
            <button
              ref={changeRef}
              type="button"
              className="text-secondary min-h-11 underline"
              disabled={locked}
              onClick={() => {
                setDraft(preview.travelDate ?? "");
                setDateError(null);
                setEditing(true);
              }}
            >
              {t("extras.change")}
            </button>
          </div>
        )}
      </div>
      ) : null}

      {ui.showRadios && fastTrack ? (
        <fieldset className="min-w-0 space-y-3" disabled={controlsDisabled}>
          <legend className="text-foreground mb-2 text-sm font-semibold">{t("extras.speed.legend")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <SpeedCard
              title={t("extras.speed.standard.title")}
              promise={t("extras.speed.standard.promise")}
              price={t("extras.speed.standard.price")}
              sum={null}
              selected={ui.selected === "standard"}
              value="standard"
              badge={null}
              disabled={controlsDisabled}
              onSelect={selectSpeed}
            />
            <SpeedCard
              title={localizedExtraCopy(fastTrack.labelI18n, locale, t("extras.speed.fast.title"))}
              promise={localizedExtraCopy(
                fastTrack.promiseI18n,
                locale,
                t("extras.speed.fast.promiseDefault"),
              )}
              price={t("extras.speed.fast.price", { price: money(fastTrack.unitAmountMinor) })}
              sum={sumLine(fastTrack.unitAmountMinor, fastTrack.travellerCount, fastTrack.sumAmountMinor)}
              selected={ui.selected === "fast_track"}
              value="fast_track"
              badge={ui.badge ? t("extras.speed.badge") : null}
              disabled={controlsDisabled}
              onSelect={selectSpeed}
            />
          </div>
        </fieldset>
      ) : (
        <p className="text-foreground text-sm">
          {t("extras.speed.standard.title")}
          {" · "}
          {t("extras.speed.standard.promise")}
        </p>
      )}

      {ui.note ? (
        <SpeedNote
          note={ui.note}
          announce={announceNote}
          relative={relative}
          price={fastTrack ? money(fastTrack.unitAmountMinor) : ""}
          t={t}
          onSwitch={() => selectSpeed("fast_track")}
          locked={controlsDisabled}
        />
      ) : null}

      {showInsurance && insurance ? (
        <fieldset
          className={cn(
            "space-y-2 rounded-[12px] border bg-card p-4",
            insuredIds.length > 0 ? "border-secondary" : "border-border",
          )}
          disabled={controlsDisabled}
        >
          <legend className="text-foreground px-1 text-sm font-semibold">{t("extras.insurance.title")}</legend>
          {memberIds.length > 1 ? (
            <label className="flex min-h-11 items-start gap-3">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="accent-primary mt-0.5 size-5 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:!outline-secondary"
                checked={allInsured}
                disabled={controlsDisabled}
                onChange={(event) => onInsuranceAll(event.target.checked)}
              />
              <span className="text-foreground text-sm font-semibold">{t("extras.insurance.selectAll")}</span>
            </label>
          ) : null}
          {(memberIds.length > 0 ? memberIds : [preview.visaLines[0]?.applicationId ?? "traveller"]).map(
            (applicationId, index) => {
              const many = memberIds.length > 1;
              const label = many
                ? t("extras.insurance.forTraveller", {
                    number: index + 1,
                    price: money(insurance.unitAmountMinor),
                  })
                : t("extras.insurance.add", { price: money(insurance.unitAmountMinor) });
              return (
                <label key={applicationId} className="flex min-h-11 items-start gap-3">
                  <input
                    type="checkbox"
                    className="accent-primary mt-0.5 size-5 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:!outline-secondary"
                    checked={insuredIds.includes(applicationId)}
                    disabled={controlsDisabled}
                    onChange={(event) => onInsurance(applicationId, event.target.checked)}
                  />
                  <span className="text-foreground text-sm font-semibold">{label}</span>
                </label>
              );
            },
          )}
          {localizedExtraCopy(insurance.descriptionI18n, locale, "") ? (
            <p className="text-muted-foreground ps-8 text-sm">
              {localizedExtraCopy(insurance.descriptionI18n, locale, "")}
            </p>
          ) : null}
          {sumLine(
            insurance.unitAmountMinor,
            insuredIds.length,
            (BigInt(insurance.unitAmountMinor) * BigInt(insuredIds.length)).toString(),
          ) ? (
            <p className="text-muted-foreground ps-8 text-xs">
              <bdi>
                {sumLine(
                  insurance.unitAmountMinor,
                  insuredIds.length,
                  (BigInt(insurance.unitAmountMinor) * BigInt(insuredIds.length)).toString(),
                )}
              </bdi>
            </p>
          ) : null}
          {insurance.termsUrl ? (
            <a
              href={insurance.termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary ms-8 inline-flex min-h-11 items-center underline"
            >
              {t("extras.insurance.terms")}
              <span className="sr-only">{t("common.opensNewTab")}</span>
            </a>
          ) : null}
        </fieldset>
      ) : null}

      {locked ? (
        <div className="border-primary bg-primary/15 text-foreground space-y-2 rounded-[12px] border p-3 text-sm" role="status">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t("extras.locked")}</span>
          </p>
          <ClientButton type="button" brand="white" className="h-11 min-w-0 px-4" onClick={onCancelCheckout}>
            {t("payment.cancelAndReset")}
          </ClientButton>
        </div>
      ) : null}

      {updateError ? (
        <div className="text-foreground flex flex-wrap items-center gap-3 text-sm" role="alert">
          <span>{updateError}</span>
          <button type="button" className="text-secondary min-h-11 underline" onClick={onRetry}>
            {t("extras.error.retry")}
          </button>
        </div>
      ) : null}
    </section>
  );
};

interface ISpeedNoteProps {
  note: TSpeedNote;
  announce: boolean;
  relative: string;
  price: string;
  t: TTranslate;
  onSwitch: () => void;
  locked: boolean;
}

const SpeedNote: FC<ISpeedNoteProps> = ({ note, announce, relative, price, t, onSwitch, locked }) => {
  const body =
    note === "n3" || note === "n4"
      ? withWhatsApp(t(`extras.notes.${note}`, { relative, price }), t("payment.whatsappHelpLink"))
      : null;
  return (
    <div
      className={cn("flex items-start gap-2 rounded-[12px] border p-3 text-sm", noteClass(note))}
      role={announce ? "status" : undefined}
    >
      <NoteIcon note={note} />
      <div className="space-y-1">
        {body ? (
          <p>
            {body.before}
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary underline"
            >
              {body.linkLabel}
            </a>
            {body.after}
          </p>
        ) : (
          <p>{t(`extras.notes.${note}`, { relative, price })}</p>
        )}
        {note === "n2" ? (
          <button
            type="button"
            className="text-secondary min-h-11 underline"
            disabled={locked}
            onClick={onSwitch}
          >
            {t("extras.notes.n2Action")}
          </button>
        ) : null}
      </div>
    </div>
  );
};
