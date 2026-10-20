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
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { iso2FlagEmoji } from "@/lib/apply/display-names";
import {
  COMBOBOX_LIST_GAP_PX,
  comboboxScrollSpacerPx,
  computeComboboxListPosition,
  isVisualViewportRelativeFixedPosition,
  mountComboboxScrollSpacer,
  readVisualViewportBox,
  scrollAnchorToVisualViewportTop,
  scrollOptionIntoContainer,
  shouldPreferBelowList,
  subscribeViewportChange,
  unmountComboboxScrollSpacer,
  type IComboboxListPosition,
} from "@/lib/client/combobox-list-position";
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
  const resolvedPlaceholder = placeholder ?? t("common.nationalityDefaultPlaceholder");
  const reactId = useId();
  const listId = `${reactId}-listbox`;
  const id = idProp ?? `${reactId}-input`;

  const selected = useMemo(
    () => (valueCode ? nationalities.find((n) => n.code === valueCode) : null),
    [nationalities, valueCode],
  );

  const closedLabel = selected ? selected.name : "";
  const selectedFlag = selected ? iso2FlagEmoji(selected.code) : "";

  const [open, setOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const firstInteractionRef = useRef(false);
  const resyncTimersRef = useRef<number[]>([]);
  const [listPos, setListPos] = useState<IComboboxListPosition | null>(null);

  const selectedIndex = useMemo(() => {
    if (!valueCode) return 0;
    const idx = nationalities.findIndex((n) => n.code === valueCode);
    return idx >= 0 ? idx : 0;
  }, [nationalities, valueCode]);

  // While the list is open with no typed query, keep showing the selected label
  // but do not use it as a filter — otherwise changing country requires deleting the name.
  const inputValue = open ? draftQuery || closedLabel : closedLabel;

  const filtered = useMemo(() => {
    const q = (open ? draftQuery : "").trim().toLowerCase();
    if (!q) return nationalities;
    return nationalities.filter(
      (n) => n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q),
    );
  }, [nationalities, draftQuery, open]);

  const activeIndex =
    filtered.length === 0 ? 0 : Math.min(highlight, Math.max(0, filtered.length - 1));

  const showList = open && filtered.length > 0;
  const showEmpty = open && filtered.length === 0 && draftQuery.trim().length > 0;
  const showPortal = showList || showEmpty;

  const syncListPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const viewport = readVisualViewportBox();
    const hasTouch = typeof window !== "undefined" && "ontouchend" in window;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setListPos(
      computeComboboxListPosition({
        anchor: { top: r.top, left: r.left, bottom: r.bottom, width: r.width, height: r.height },
        viewport,
        preferBelow: shouldPreferBelowList(viewport.width || window.innerWidth),
        subtractVisualOffset: isVisualViewportRelativeFixedPosition(ua, hasTouch),
      }),
    );
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
    if (!showPortal) return;
    const selectedEl = portalRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const listEl = listboxRef.current;
    if (selectedEl && listEl) {
      scrollOptionIntoContainer(selectedEl, listEl);
    }
  }, [showPortal, activeIndex, listPos]);

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
      setDraftQuery("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const openList = useCallback(
    (query = "") => {
      if (!firstInteractionRef.current) {
        firstInteractionRef.current = true;
        onFirstInteraction?.();
      }
      setOpen(true);
      setDraftQuery(query);
      setHighlight(query.trim() ? 0 : selectedIndex);
    },
    [onFirstInteraction, selectedIndex],
  );

  const pick = useCallback(
    (code: string) => {
      setOpen(false);
      setDraftQuery("");
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
      setHighlight((h) => (filtered.length === 0 ? 0 : Math.min(filtered.length - 1, h + 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = filtered[activeIndex];
      if (row) pick(row.code);
    } else if (e.key === "Escape") {
      setOpen(false);
      setDraftQuery("");
    }
  };

  const revealAnchorThenOpen = (query?: string) => {
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
        className="overflow-auto overscroll-contain py-1"
        style={{ maxHeight: listPos.maxHeight }}
      >
        {filtered.map((n, i) => {
          const flag = iso2FlagEmoji(n.code);
          return (
            <li key={n.code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors",
                  i === activeIndex && "bg-accent text-accent-foreground",
                )}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(n.code)}
              >
                {flag ? (
                  <span className="w-6 shrink-0 text-base leading-none" aria-hidden>
                    {flag}
                  </span>
                ) : null}
                <span className="min-w-0 font-medium">{n.name}</span>
              </button>
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
          "border-border bg-popover text-popover-foreground pointer-events-auto z-[100] overflow-hidden rounded-[10px] border shadow-lg",
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
    <div ref={wrapRef} className={cn("relative w-full", open && "z-[100]", className)}>
      <div className="relative">
        {selectedFlag && !open ? (
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 leading-none",
              hero ? "left-4 text-2xl" : "left-3 text-lg",
            )}
            aria-hidden
          >
            {selectedFlag}
          </span>
        ) : (
          <Globe
            className={cn(
              "text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2",
              hero ? "left-4 size-6" : "left-3 size-5",
            )}
            aria-hidden
          />
        )}
        <ClientInput
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
          onFocus={(e) => {
            revealAnchorThenOpen();
            e.currentTarget.select();
          }}
          onClick={(e) => {
            if (!open) {
              revealAnchorThenOpen();
              e.currentTarget.select();
            }
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "w-full border-border pr-11 shadow-sm",
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
