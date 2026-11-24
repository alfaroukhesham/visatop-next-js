import type { TChooserPhase } from "@/lib/apply/guided-visa-filter";
import type { TPartyTravelerDraft } from "@/lib/apply/party-travelers";
import type { TStayBucket, TTravelerKind } from "@/lib/catalog/guided-choice";
import { isIso4217CurrencyCode } from "@/lib/catalog/local-currency";

export type TChooserDraft = {
  displayCurrency: string;
  serviceId: string;
  stay: TStayBucket | null;
  entry: "single" | "multiple";
  kind: TTravelerKind;
  phase: TChooserPhase;
  additionalTravelers: TPartyTravelerDraft[];
  email: string;
  /** YYYY-MM-DD arrival date, or empty when the customer has not chosen one. */
  travelDate: string;
};

const storageKey = (nationality: string): string =>
  `visatop:chooser:${nationality.trim().toUpperCase()}`;

const isStayBucket = (value: unknown): value is TStayBucket =>
  value === "1_14" ||
  value === "15_30" ||
  value === "31_60" ||
  value === "transit" ||
  value === "5_year";

const isPhase = (value: unknown): value is TChooserPhase =>
  value === "stay" || value === "entry" || value === "kind" || value === "date" || value === "results";

const FRESH_START_KEY = "visatop:chooser-fresh";

type TSessionLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const getSessionStorage = (): TSessionLike | null => {
  try {
    const storage = (globalThis as { sessionStorage?: TSessionLike }).sessionStorage;
    return storage ?? null;
  } catch {
    return null;
  }
};

/** Home "start" sets this so the next /apply/start visit does not restore an older chooser. */
export function markChooserFreshStart(): void {
  getSessionStorage()?.setItem(FRESH_START_KEY, "1");
}

export function peekChooserFreshStart(): boolean {
  return getSessionStorage()?.getItem(FRESH_START_KEY) === "1";
}

export function consumeChooserFreshStart(): void {
  getSessionStorage()?.removeItem(FRESH_START_KEY);
}

export function clearChooserDraft(nationality: string): void {
  const storage = getSessionStorage();
  if (!storage) return;
  const code = nationality.trim().toUpperCase();
  if (code.length !== 2) return;
  storage.removeItem(storageKey(code));
}

/** Restore only when the customer is resuming this chooser, or reloading it. A fresh start stays empty. */
export const shouldRestoreChooserDraft = (input: {
  fresh: boolean;
  resume: boolean;
  reloaded: boolean;
}): boolean => !input.fresh && (input.resume || input.reloaded);

export function readChooserDraft(nationality: string): TChooserDraft | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  const code = nationality.trim().toUpperCase();
  if (code.length !== 2) return null;
  try {
    const raw = storage.getItem(storageKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TChooserDraft>;
    const displayCurrency =
      typeof parsed.displayCurrency === "string" ? parsed.displayCurrency.trim().toUpperCase() : "";
    if (!isIso4217CurrencyCode(displayCurrency)) return null;
    if (!isPhase(parsed.phase)) return null;
    if (parsed.stay !== null && parsed.stay !== undefined && !isStayBucket(parsed.stay)) return null;
    return {
      displayCurrency,
      serviceId: typeof parsed.serviceId === "string" ? parsed.serviceId : "",
      stay: parsed.stay ?? null,
      entry: parsed.entry === "multiple" ? "multiple" : "single",
      kind: parsed.kind === "child" ? "child" : "adult",
      phase: parsed.phase,
      additionalTravelers: Array.isArray(parsed.additionalTravelers)
        ? parsed.additionalTravelers.filter(
            (t): t is TPartyTravelerDraft =>
              Boolean(t) &&
              typeof t.key === "string" &&
              (t.kind === "adult" || t.kind === "child") &&
              typeof t.serviceId === "string",
          )
        : [],
      email: typeof parsed.email === "string" ? parsed.email : "",
      travelDate: typeof parsed.travelDate === "string" ? parsed.travelDate : "",
    };
  } catch {
    return null;
  }
}

export function writeChooserDraft(nationality: string, draft: TChooserDraft): void {
  const storage = getSessionStorage();
  if (!storage) return;
  const code = nationality.trim().toUpperCase();
  if (code.length !== 2) return;
  try {
    storage.setItem(storageKey(code), JSON.stringify(draft));
  } catch {
    // private mode / quota
  }
}
