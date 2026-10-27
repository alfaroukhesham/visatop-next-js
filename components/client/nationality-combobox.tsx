"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Globe } from "lucide-react";
import { ClientInput } from "@/components/client/client-input";
import { useCustomerLocale, useCustomerT } from "@/components/client/customer-i18n-provider";
import { iso2FlagEmoji } from "@/lib/apply/display-names";
import {
  COMBOBOX_LIST_GAP_PX,
  COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX,
  WP_SHELL_HEADER_HEIGHT_VAR,
  comboboxScrollSpacerPx,
  computeComboboxListPosition,
  isInternalListScrollEvent,
  isVisualViewportRelativeFixedPosition,
  mountComboboxScrollSpacer,
  readViewportFooterTopPx,
  readVisualViewportBox,
  scrollAnchorToVisualViewportTop,
  scrollOptionIntoContainer,
  shouldPreferBelowList,
  subscribeViewportChange,
  unmountComboboxScrollSpacer,
  type IComboboxListPosition,
} from "@/lib/client/combobox-list-position";
import {
  filterNationalityOptions,
  nationalityLocalizedName,
} from "@/lib/i18n/nationality-search";
import { cn } from "@/lib/utils";

export type NationalityOption = { code: string; name: string };

interface INationalityComboboxProps {
  id?: string;
  nationalities: NationalityOption[];
  valueCode: string | null;
  onSelectCode: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Larger padding + text for hero usage */
  size?: "default" | "hero";
  className?: string;
  inputClassName?: string;
  onFirstInteraction?: () => void;
}

/**
 * Searchable nationality combobox. On mobile the results list is `position:
 * absolute; top: 100%` under the input so it cannot cover the field or the
 * heading above it. Desktop still portals a `position: fixed` list to
 * `document.body` (home hero overflow / `theme-client-rise` transform). Height
 * is computed against `visualViewport` so iOS Safari's keyboard cannot push the
 * list off-screen; the list scrolls internally.
 */
export const NationalityCombobox: FC<INationalityComboboxProps> = ({
  id: idProp,
  nationalities,
  valueCode,
  onSelectCode,
  placeholder,
  disabled,
  size = "default",
  className,
  inputClassName,
  onFirstInteraction,
}) => {
  const t = useCustomerT();
  const locale = useCustomerLocale();
  const resolvedPlaceholder = placeholder ?? t("common.nationalityDefaultPlaceholder");
  const reactId = useId();
  const listId = `${reactId}-listbox`;
  const id = idProp ?? `${reactId}-input`;

  const selected = useMemo(
    () => (valueCode ? nationalities.find((n) => n.code === valueCode) : null),
    [nationalities, valueCode],
  );

  const labelFor = (n: NationalityOption) => nationalityLocalizedName(n.code, n.name, locale);
  const closedLabel = selected ? labelFor(selected) : "";
  const selectedFlag = selected ? iso2FlagEmoji(selected.code) : "";

  const [open, setOpen] = useState(false);
  // null = show the committed label (and do not filter). "" = user cleared the
  // field. A non-empty string is the active filter. `draftQuery || closedLabel`
  // treated "" as "not editing" and forced the selected name back on Backspace.
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const selectCommittedLabelRef = useRef(false);
  const firstInteractionRef = useRef(false);
  const resyncTimersRef = useRef<number[]>([]);
  const revealActiveOnKeyboardRef = useRef(false);
  const [listPos, setListPos] = useState<IComboboxListPosition | null>(null);

  const selectedIndex = useMemo(() => {
    if (!valueCode) return 0;
    const idx = nationalities.findIndex((n) => n.code === valueCode);
    return idx >= 0 ? idx : 0;
  }, [nationalities, valueCode]);

  const inputValue = open && draftQuery !== null ? draftQuery : closedLabel;

  const filtered = useMemo(() => {
    if (!open) return nationalities;
    return filterNationalityOptions(nationalities, draftQuery ?? "", locale);
  }, [nationalities, draftQuery, open, locale]);

  const activeIndex =
    filtered.length === 0 ? 0 : Math.min(highlight, Math.max(0, filtered.length - 1));

  const showList = open && filtered.length > 0;
  const showEmpty = open && filtered.length === 0 && (draftQuery ?? "").trim().length > 0;
  const showPortal = showList || showEmpty;

  const syncListPosition = useCallback((event?: Event) => {
    if (isInternalListScrollEvent(event, listboxRef.current)) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const viewport = readVisualViewportBox();
    const hasTouch = typeof window !== "undefined" && "ontouchend" in window;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const subtractVisualOffset = isVisualViewportRelativeFixedPosition(ua, hasTouch);
    const footerTopClient = readViewportFooterTopPx(viewport);
    const next = computeComboboxListPosition({
      anchor: { top: r.top, left: r.left, bottom: r.bottom, width: r.width, height: r.height },
      viewport,
      preferBelow: shouldPreferBelowList(viewport.width || window.innerWidth),
      subtractVisualOffset,
      footerTop: subtractVisualOffset ? footerTopClient - viewport.offsetTop : footerTopClient,
    });
    setListPos((prev) => {
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.maxHeight === next.maxHeight &&
        prev.placement === next.placement &&
        prev.mode === next.mode
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      unmountComboboxScrollSpacer();
      return;
    }
    const reveal = () => {
      const viewport = readVisualViewportBox();
      if (shouldPreferBelowList(viewport.width || window.innerWidth)) {
        mountComboboxScrollSpacer(comboboxScrollSpacerPx(viewport));
      }
      if (wrapRef.current) scrollAnchorToVisualViewportTop(wrapRef.current);
    };
    reveal();
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    vv?.addEventListener("resize", reveal);
    window.addEventListener("resize", reveal);
    return () => {
      vv?.removeEventListener("resize", reveal);
      window.removeEventListener("resize", reveal);
      unmountComboboxScrollSpacer();
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!showPortal) return;
    syncListPosition();
    return subscribeViewportChange(syncListPosition);
  }, [showPortal, syncListPosition, draftQuery, filtered.length]);

  useLayoutEffect(() => {
    if (!open || draftQuery !== null || !selectCommittedLabelRef.current) return;
    selectCommittedLabelRef.current = false;
    const el = inputRef.current;
    if (!el || !el.value) return;
    el.select();
  }, [open, draftQuery, inputValue]);

  useLayoutEffect(() => {
    if (!showPortal || !revealActiveOnKeyboardRef.current) return;
    revealActiveOnKeyboardRef.current = false;
    const selectedEl = portalRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const listEl = listboxRef.current;
    if (selectedEl && listEl) {
      scrollOptionIntoContainer(selectedEl, listEl);
    }
  }, [showPortal, activeIndex]);

  useEffect(() => {
    const el = listboxRef.current;
    if (!el || !showList) return;
    let lastPointerY: number | null = null;
    const applyDelta = (delta: number, event: Event) => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 1) return;
      const next = Math.max(0, Math.min(max, el.scrollTop + delta));
      if (next === el.scrollTop) return;
      event.preventDefault();
      event.stopPropagation();
      el.scrollTop = next;
    };
    const onWheel = (event: WheelEvent) => {
      event.stopPropagation();
      applyDelta(event.deltaY, event);
    };
    const onPointerDown = (event: PointerEvent) => {
      lastPointerY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (lastPointerY == null) return;
      if (event.pointerType === "mouse" && event.buttons === 0) return;
      event.stopPropagation();
      const delta = lastPointerY - event.clientY;
      lastPointerY = event.clientY;
      applyDelta(delta, event);
    };
    const onPointerUp = () => {
      lastPointerY = null;
    };
    const onTouchStart = (event: TouchEvent) => {
      lastPointerY = event.touches[0]?.clientY ?? lastPointerY;
    };
    const onTouchMove = (event: TouchEvent) => {
      event.stopPropagation();
      const y = event.touches[0]?.clientY;
      if (lastPointerY == null || y == null) return;
      const delta = lastPointerY - y;
      lastPointerY = y;
      applyDelta(delta, event);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [showList, listPos?.maxHeight]);

  useEffect(() => {
    return () => {
      resyncTimersRef.current.forEach((id) => window.clearTimeout(id));
      resyncTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      setOpen(false);
      setDraftQuery(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const openList = useCallback(
    (query: string | null = null) => {
      if (!firstInteractionRef.current) {
        firstInteractionRef.current = true;
        onFirstInteraction?.();
      }
      setOpen(true);
      setDraftQuery(query);
      setHighlight(query != null && query.trim() ? 0 : selectedIndex);
      if (query == null) selectCommittedLabelRef.current = true;
    },
    [onFirstInteraction, selectedIndex],
  );

  const pick = useCallback(
    (code: string) => {
      setOpen(false);
      setDraftQuery(null);
      onSelectCode(code);
    },
    [onSelectCode],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      revealActiveOnKeyboardRef.current = true;
      setHighlight((h) => (filtered.length === 0 ? 0 : Math.min(filtered.length - 1, h + 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      revealActiveOnKeyboardRef.current = true;
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = filtered[activeIndex];
      if (row) pick(row.code);
    } else if (e.key === "Escape") {
      setOpen(false);
      setDraftQuery(null);
    }
  };

  const revealAnchorThenOpen = (query: string | null = null) => {
    const resync = () => {
      if (wrapRef.current) scrollAnchorToVisualViewportTop(wrapRef.current);
      syncListPosition();
    };
    if (wrapRef.current) scrollAnchorToVisualViewportTop(wrapRef.current);
    openList(query);
    requestAnimationFrame(() => {
      resync();
      requestAnimationFrame(resync);
    });
    resyncTimersRef.current.forEach((id) => window.clearTimeout(id));
    resyncTimersRef.current = [80, 250].map((ms) => window.setTimeout(resync, ms) as unknown as number);
  };

  const hero = size === "hero";
  const inlineList = Boolean(listPos && listPos.mode === "inline");

  const listInner =
    showList && listPos ? (
      <ul
        ref={listboxRef}
        id={listId}
        role="listbox"
        className="overflow-auto overscroll-contain py-1 select-none"
        style={{
          maxHeight: listPos.maxHeight,
          touchAction: "pan-y",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
        onScroll={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {filtered.map((n, i) => {
          const flag = iso2FlagEmoji(n.code);
          return (
            <li key={n.code} role="presentation" style={{ touchAction: "pan-y" }}>
              <div
                role="option"
                tabIndex={-1}
                aria-selected={i === activeIndex}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm transition-colors",
                  i === activeIndex && "bg-accent text-accent-foreground",
                )}
                style={{ touchAction: "pan-y" }}
                onMouseEnter={() => setHighlight(i)}
                onPointerDown={(e) => {
                  if (e.pointerType === "touch") return;
                  e.preventDefault();
                }}
                onClick={() => pick(n.code)}
              >
                {flag ? (
                  <span className="w-6 shrink-0 text-base leading-none" aria-hidden>
                    {flag}
                  </span>
                ) : null}
                <span className="min-w-0 font-medium">{labelFor(n)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    ) : showEmpty ? (
      <p id={listId} className="text-muted-foreground px-4 py-3 text-sm" role="status">
        {t("common.noCountryMatch")}
      </p>
    ) : null;

  const dropdownShell =
    showPortal && listPos && listInner ? (
      <div
        ref={portalRef}
        data-placement={listPos.placement}
        data-list-mode={listPos.mode}
        className={cn(
          "border-border bg-popover text-popover-foreground pointer-events-auto z-[100] rounded-[10px] border shadow-lg",
          inlineList ? "absolute inset-x-0" : "fixed",
        )}
        style={
          inlineList
            ? {
                top: "100%",
                marginTop: COMBOBOX_LIST_GAP_PX,
                maxHeight: listPos.maxHeight,
              }
            : {
                top: listPos.top,
                left: listPos.left,
                width: listPos.width,
                maxHeight: listPos.maxHeight,
              }
        }
      >
        {listInner}
      </div>
    ) : null;

  const portalContent =
    !inlineList && typeof document !== "undefined" && dropdownShell
      ? createPortal(dropdownShell, document.body)
      : null;

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full", open && "z-[100]", className)}
      data-combobox-query={open ? (draftQuery ?? "") : undefined}
      style={{
        scrollMarginTop: `calc(var(${WP_SHELL_HEADER_HEIGHT_VAR}, 0px) + ${COMBOBOX_LIST_VIEWPORT_TOP_PADDING_PX}px)`,
      }}
    >
      <div className="relative">
        {selectedFlag && !open ? (
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 leading-none max-[240px]:hidden",
              hero ? "left-4 text-2xl" : "left-3 text-lg",
            )}
            aria-hidden
          >
            {selectedFlag}
          </span>
        ) : (
          <Globe
            className={cn(
              "text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 max-[240px]:hidden",
              hero ? "left-4 size-6" : "left-3 size-5",
            )}
            aria-hidden
          />
        )}
        <ClientInput
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder={resolvedPlaceholder}
          value={inputValue}
          onChange={(e) => {
            openList(e.target.value);
          }}
          onFocus={() => {
            if (!open) revealAnchorThenOpen();
          }}
          onClick={(e) => {
            if (!open) revealAnchorThenOpen();
            if (draftQuery === null) e.currentTarget.select();
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "w-full border-border pr-11 shadow-sm max-[240px]:pl-3",
            hero ? "min-h-[3.5rem] rounded-[10px] py-4 pl-12 text-lg md:min-h-[4rem] md:text-xl" : "pl-10",
            inputClassName,
          )}
        />
        <ChevronDown
          className={cn(
            "text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2",
            hero ? "size-6" : "size-5",
          )}
          aria-hidden
        />
      </div>
      {inlineList ? dropdownShell : portalContent}
    </div>
  );
};
