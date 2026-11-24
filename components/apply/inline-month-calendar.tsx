"use client";

import { useEffect, useId, useRef, useState, type FC, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { addCalendarDays, isRealIsoDate } from "@/lib/checkout-extras/dubai-calendar";
import { isCustomerLocaleRtl } from "@/lib/i18n/customer-locale";
import {
  buildMonthGrid,
  canShiftMonth,
  clampMonth,
  formatCalendarDayLabel,
  formatCalendarDayNumber,
  formatCalendarMonthTitle,
  formatCalendarSelection,
  monthKey,
  monthPartsFromIso,
  shiftMonth,
  weekdayHeaders,
  visibleMonthCells,
  weekStartsOn,
  type TMonthParts,
} from "@/lib/apply/month-calendar";
import { cn } from "@/lib/utils";

interface IInlineMonthCalendarProps {
  value: string;
  onChange: (value: string) => void;
  todayUae: string;
  maxTravelDate: string;
  describedBy?: string;
  focusToken?: number;
}

const monthForValue = (value: string, todayUae: string, maxTravelDate: string): TMonthParts => {
  const seed = isRealIsoDate(value) ? value : todayUae;
  return clampMonth(monthPartsFromIso(seed), todayUae, maxTravelDate);
};

const focusDay = (node: HTMLElement) => {
  node.focus({ focusVisible: true } as FocusOptions);
};

export const InlineMonthCalendar: FC<IInlineMonthCalendarProps> = ({
  value,
  onChange,
  todayUae,
  maxTravelDate,
  describedBy,
  focusToken = 0,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const rtl = isCustomerLocaleRtl(locale);
  const gridId = useId();
  const monthTitleId = useId();
  const pendingFocus = useRef<string | null>(null);
  const selected = isRealIsoDate(value) ? value : "";
  const [visible, setVisible] = useState(() => monthForValue(selected, todayUae, maxTravelDate));
  const [seenValue, setSeenValue] = useState(selected);
  const [focused, setFocused] = useState(selected || todayUae);
  const [seenFocusToken, setSeenFocusToken] = useState(0);
  const [errorRingIso, setErrorRingIso] = useState<string | null>(null);

  if (selected !== seenValue) {
    setSeenValue(selected);
    if (selected) {
      const next = monthForValue(selected, todayUae, maxTravelDate);
      setVisible((current) => (monthKey(current) === monthKey(next) ? current : next));
      setFocused(selected);
    }
  }

  const weekStart = weekStartsOn(locale);
  const cells = visibleMonthCells(
    buildMonthGrid({
      parts: visible,
      weekStart,
      todayUae,
      maxTravelDate,
    }),
  );
  const errorFocusIso =
    (selected && cells.some((cell) => cell.iso === selected) ? selected : null) ??
    cells.find((cell) => cell.iso === todayUae && !cell.disabled)?.iso ??
    cells.find((cell) => !cell.disabled)?.iso ??
    null;
  if (focusToken !== seenFocusToken) {
    setSeenFocusToken(focusToken);
    setErrorRingIso(focusToken > 0 ? errorFocusIso : null);
    if (errorFocusIso) setFocused(errorFocusIso);
  }
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const headers = weekdayHeaders(locale, weekStart);
  const canPrev = canShiftMonth(visible, -1, todayUae, maxTravelDate);
  const canNext = canShiftMonth(visible, 1, todayUae, maxTravelDate);
  const tabIso = cells.some((cell) => cell.iso === focused)
    ? focused
    : (cells.find((cell) => cell.iso === todayUae)?.iso ??
      cells.find((cell) => !cell.disabled)?.iso ??
      cells[0]?.iso);

  useEffect(() => {
    const iso = pendingFocus.current;
    if (!iso) return;
    pendingFocus.current = null;
    const node = document.getElementById(`${gridId}-${iso}`);
    if (node instanceof HTMLElement) focusDay(node);
  }, [focused, gridId, visible]);

  useEffect(() => {
    if (!focusToken || !errorRingIso) return;
    const node = document.getElementById(`${gridId}-${errorRingIso}`);
    if (node instanceof HTMLElement) focusDay(node);
  }, [focusToken, errorRingIso, gridId]);

  const focusIso = (iso: string) => {
    const inGrid = cells.some((cell) => cell.iso === iso);
    if (!inGrid) {
      const month = iso.slice(0, 7);
      if (month < todayUae.slice(0, 7) || month > maxTravelDate.slice(0, 7)) return;
      setVisible(clampMonth(monthPartsFromIso(`${month}-01`), todayUae, maxTravelDate));
    }
    pendingFocus.current = iso;
    setFocused(iso);
  };

  const selectDay = (iso: string) => {
    const cell = cells.find((item) => item.iso === iso);
    if (!cell || cell.disabled) return;
    pendingFocus.current = iso;
    setErrorRingIso(null);
    setFocused(iso);
    onChange(iso);
  };

  const onDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, iso: string) => {
    const move =
      event.key === "ArrowLeft"
        ? rtl
          ? 1
          : -1
        : event.key === "ArrowRight"
          ? rtl
            ? -1
            : 1
          : event.key === "ArrowUp"
            ? -7
            : event.key === "ArrowDown"
              ? 7
              : null;
    if (move !== null) {
      event.preventDefault();
      focusIso(addCalendarDays(iso, move));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = cells.findIndex((cell) => cell.iso === iso);
      if (index < 0) return;
      const rowStart = index - (index % 7);
      const target = cells[event.key === "Home" ? rowStart : rowStart + 6];
      if (target) focusIso(target.iso);
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const delta = event.key === "PageUp" ? -1 : 1;
      if (!canShiftMonth(visible, delta, todayUae, maxTravelDate)) return;
      const nextMonth = shiftMonth(visible, delta);
      const day = iso.slice(8, 10);
      const candidate = `${monthKey(nextMonth)}-${day}`;
      focusIso(isRealIsoDate(candidate) ? candidate : `${monthKey(nextMonth)}-01`);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDay(iso);
    }
  };

  const shift = (delta: -1 | 1) => {
    if (!canShiftMonth(visible, delta, todayUae, maxTravelDate)) return;
    setVisible(shiftMonth(visible, delta));
  };

  const selectionLabel = selected ? formatCalendarSelection(selected, locale) : "";

  return (
    <div
      data-testid="travel-date-calendar"
      className={cn(
        "border-border bg-card relative w-full min-w-0 max-w-full rounded-3xl border py-4 shadow-[0_16px_40px_rgba(1,32,49,0.08)] [max-inline-size:100%]",
        "sm:mx-auto sm:max-w-[32rem] sm:py-6",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-2 sm:px-5">
        <button
          type="button"
          data-testid="travel-date-prev-month"
          className="text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:!outline-secondary inline-flex size-11 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={t("start.travelDate.previousMonth")}
          disabled={!canPrev}
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
        </button>
        <h4 id={monthTitleId} className="text-foreground text-center text-base font-semibold sm:text-lg">
          {formatCalendarMonthTitle(visible, locale)}
        </h4>
        <button
          type="button"
          data-testid="travel-date-next-month"
          className="text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:!outline-secondary inline-flex size-11 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={t("start.travelDate.nextMonth")}
          disabled={!canNext}
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
        </button>
      </div>
      <div
        id="travel-date-calendar-grid"
        role="grid"
        aria-labelledby={monthTitleId}
        className="min-w-0 space-y-1 px-1 sm:px-5"
      >
        <div role="row" className="grid grid-cols-7">
          {headers.map((header, index) => (
            <div
              key={`${header.label}-${index}`}
              role="columnheader"
              aria-label={header.label}
              className="text-muted-foreground flex h-8 items-center justify-center text-[11px] font-semibold tracking-wide uppercase sm:text-xs"
            >
              <span aria-hidden>{header.visible}</span>
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]?.iso} role="row" className="grid grid-cols-7">
            {week.map((cell) => {
              const isSelected = selected !== "" && cell.iso === selected;
              const isToday = cell.iso === todayUae;
              const dayLabel = formatCalendarDayLabel(cell.iso, locale);
              return (
                <button
                  key={cell.iso}
                  id={`${gridId}-${cell.iso}`}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-disabled={cell.disabled}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={
                    cell.disabled ? `${dayLabel}, ${t("start.travelDate.unavailable")}` : dayLabel
                  }
                  aria-describedby={describedBy}
                  tabIndex={cell.iso === tabIso ? 0 : -1}
                  className={cn(
                    "group flex min-h-10 min-w-10 w-full items-center justify-center rounded-2xl",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:!outline-secondary",
                    cell.iso === errorRingIso && "outline-2 outline-offset-2 !outline-secondary",
                    cell.disabled ? "cursor-default" : "cursor-pointer",
                  )}
                  onClick={() => selectDay(cell.iso)}
                  onKeyDown={(event) => onDayKeyDown(event, cell.iso)}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-2xl text-sm tabular-nums sm:size-11",
                      cell.disabled
                        ? "text-muted-foreground/50 line-through decoration-2 decoration-muted-foreground"
                        : isSelected
                          ? "bg-secondary text-secondary-foreground font-semibold"
                          : "text-foreground group-hover:bg-muted",
                      !cell.inMonth && !cell.disabled && !isSelected && "text-muted-foreground",
                      isToday && !isSelected && "ring-secondary font-semibold ring-2 ring-inset",
                    )}
                  >
                    {formatCalendarDayNumber(cell.iso, locale)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-border px-4 pt-4 sm:px-5">
        <span
          className="bg-secondary/10 text-secondary flex size-10 shrink-0 items-center justify-center rounded-full"
          aria-hidden
        >
          <CalendarDays className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-secondary text-[11px] font-semibold tracking-[0.14em] uppercase">
            {t("start.travelDate.departureDate")}
          </p>
          <p className="text-foreground truncate text-sm font-semibold" data-testid="departure-date-readback">
            {selectionLabel ? (
              <bdi>{selectionLabel}</bdi>
            ) : (
              <span className="text-muted-foreground font-medium">{t("start.travelDate.pickDate")}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
