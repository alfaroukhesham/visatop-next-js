"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Globe } from "lucide-react";
import { ClientInput } from "@/components/client/client-input";
import { cn } from "@/lib/utils";

export type NationalityOption = { code: string; name: string };

type ListPosition = { top: number; left: number; width: number };

type NationalityComboboxProps = {
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
};

export function NationalityCombobox({
  id: idProp,
  nationalities,
  valueCode,
  onSelectCode,
  placeholder = "Type your country or code…",
  disabled,
  size = "default",
  className,
  inputClassName,
}: NationalityComboboxProps) {
  const reactId = useId();
  const listId = `${reactId}-listbox`;
  const id = idProp ?? `${reactId}-input`;

  const selected = useMemo(
    () => (valueCode ? nationalities.find((n) => n.code === valueCode) : null),
    [nationalities, valueCode],
  );

  const closedLabel = selected ? `${selected.name} (${selected.code})` : "";

  const [open, setOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [listPos, setListPos] = useState<ListPosition | null>(null);

  const inputValue = open ? draftQuery : closedLabel;

  const filtered = useMemo(() => {
    const q = (open ? draftQuery : "").trim().toLowerCase();
    if (!q) return nationalities;
    return nationalities.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.code.toLowerCase().includes(q) ||
        `${n.name} (${n.code})`.toLowerCase().includes(q),
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
    setListPos({ top: r.bottom + 8, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!showPortal) return;
    syncListPosition();
    const onScrollOrResize = () => syncListPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showPortal, syncListPosition, draftQuery, filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (portalRef.current?.contains(t)) return;
      setOpen(false);
      setDraftQuery("");
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = useCallback(
    (code: string) => {
      setOpen(false);
      setDraftQuery("");
      onSelectCode(code);
    },
    [onSelectCode],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      setDraftQuery(closedLabel);
      setHighlight(0);
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
  }

  const hero = size === "hero";

  const portalContent =
    typeof document !== "undefined" &&
    showPortal &&
    listPos &&
    createPortal(
      <div
        ref={portalRef}
        className="border-border bg-popover text-popover-foreground pointer-events-auto fixed z-[100] max-h-[min(22rem,calc(100dvh-2rem))] overflow-hidden rounded-[10px] border shadow-lg"
        style={{
          top: listPos.top,
          left: listPos.left,
          width: listPos.width,
        }}
      >
        {showList ? (
          <ul id={listId} role="listbox" className="max-h-[min(22rem,calc(100dvh-2rem))] overflow-auto py-1">
            {filtered.map((n, i) => (
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
                  <span className="text-muted-foreground w-9 shrink-0 font-mono text-xs uppercase">
                    {n.code}
                  </span>
                  <span className="min-w-0 font-medium">{n.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p id={listId} className="text-muted-foreground px-4 py-3 text-sm" role="status">
            No country matches that search.
          </p>
        )}
      </div>,
      document.body,
    );

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Globe
          className={cn(
            "text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2",
            hero ? "left-4 size-6" : "left-3 size-5",
          )}
          aria-hidden
        />
        <ClientInput
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            setDraftQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            setDraftQuery(closedLabel);
            setHighlight(0);
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
      {portalContent}
    </div>
  );
}
