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
  weekStartsOn,
  type TMonthParts,
} from "@/lib/apply/month-calendar";
import { cn } from "@/lib/utils";

interface IInlineMonthCalendarProps {
  value: string;
  onChange: (value: string) => void;
  todayUae: string;
  maxTravelDate: string;
}

const monthForValue = (value: string, todayUae: string, maxTravelDate: string): TMonthParts => {
  const seed = isRealIsoDate(value) ? value : todayUae;
  return clampMonth(monthPartsFromIso(seed), todayUae, maxTravelDate);
};

export const InlineMonthCalendar: FC<IInlineMonthCalendarProps> = ({
  value,
  onChange,
  todayUae,
  maxTravelDate,
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

  if (selected !== seenValue) {
    setSeenValue(selected);
    if (selected) {
      const next = monthForValue(selected, todayUae, maxTravelDate);
      setVisible((current) => (monthKey(current) === monthKey(next) ? current : next));
      setFocused(selected);
    }
  }

  const weekStart = weekStartsOn(locale);
  const cells = buildMonthGrid({
    parts: visible,
    weekStart,
    todayUae,
    maxTravelDate,
  });
  const weeks = Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
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
    document.getElementById(`${gridId}-${iso}`)?.focus();
  }, [focused, gridId, visible]);

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
        "border-border bg-card relative w-full rounded-3xl border py-4 shadow-[0_16px_40px_rgba(1,32,49,0.08)]",
        "max-sm:start-1/2 max-sm:w-[calc(100vw-0.25rem)] max-sm:-translate-x-1/2 max-sm:rtl:translate-x-1/2",
        "sm:mx-auto sm:max-w-[32rem] sm:py-6",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-2 sm:px-5">
        <button
          type="button"
          data-testid="travel-date-prev-month"
          className="text-foreground hover:bg-muted inline-flex size-11 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-30"
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
          className="text-foreground hover:bg-muted inline-flex size-11 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-30"
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
        tabIndex={-1}
        className="space-y-1 px-px outline-none sm:px-5"
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
              const isSelected = cell.iso === selected;
              const isToday = cell.iso === todayUae;
              return (
                <button
                  key={cell.iso}
                  id={`${gridId}-${cell.iso}`}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-disabled={cell.disabled}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={formatCalendarDayLabel(cell.iso, locale)}
                  tabIndex={cell.iso === tabIso ? 0 : -1}
                  className={cn(
                    "group flex min-h-11 w-full items-center justify-center",
                    cell.disabled ? "cursor-default" : "cursor-pointer",
                  )}
                  onClick={() => selectDay(cell.iso)}
                  onKeyDown={(event) => onDayKeyDown(event, cell.iso)}
                >
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-2xl text-sm tabular-nums",
                      "group-focus-visible:ring-ring group-focus-visible:ring-2 group-focus-visible:outline-none",
                      cell.disabled
                        ? "text-muted-foreground/40"
                        : isSelected
                          ? "bg-secondary text-secondary-foreground font-semibold"
                          : "text-foreground group-hover:bg-muted",
                      !cell.inMonth && !cell.disabled && !isSelected && "text-muted-foreground",
                      isToday && !isSelected && "ring-secondary/40 font-semibold ring-1 ring-inset",
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
              <span className="text-muted-foreground font-medium">—</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
