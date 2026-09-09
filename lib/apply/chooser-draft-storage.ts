import type { TChooserPhase } from "@/lib/apply/guided-visa-filter";
import type { TPartyTravelerDraft } from "@/lib/apply/party-travelers";
import type { TStayBucket, TTravelerKind } from "@/lib/catalog/guided-choice";

export type TChooserDraft = {
  displayCurrency: "USD" | "AED";
  serviceId: string;
  stay: TStayBucket | null;
  entry: "single" | "multiple";
  kind: TTravelerKind;
  phase: TChooserPhase;
  additionalTravelers: TPartyTravelerDraft[];
  email: string;
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
  value === "stay" || value === "entry" || value === "kind" || value === "results";

type TSessionLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const getSessionStorage = (): TSessionLike | null => {
  try {
    const storage = (globalThis as { sessionStorage?: TSessionLike }).sessionStorage;
    return storage ?? null;
  } catch {
    return null;
  }
};

export function readChooserDraft(nationality: string): TChooserDraft | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  const code = nationality.trim().toUpperCase();
  if (code.length !== 2) return null;
  try {
    const raw = storage.getItem(storageKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TChooserDraft>;
    if (parsed.displayCurrency !== "USD" && parsed.displayCurrency !== "AED") return null;
    if (!isPhase(parsed.phase)) return null;
    if (parsed.stay !== null && parsed.stay !== undefined && !isStayBucket(parsed.stay)) return null;
    return {
      displayCurrency: parsed.displayCurrency,
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
