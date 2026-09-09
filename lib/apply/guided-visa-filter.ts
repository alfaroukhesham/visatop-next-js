import {
  STAY_BUCKETS,
  TRAVELER_KINDS,
  type TEntryKind,
  type TStayBucket,
  type TTravelerKind,
} from "@/lib/catalog/guided-choice";

export type TGuidedService = {
  id: string;
  stayBucket: TStayBucket | null;
  entryKind: TEntryKind;
  travelerKind: TTravelerKind;
  showInGuidedChooser: boolean;
};

export const filterGuidedServices = (
  services: TGuidedService[],
  answers: { stay: TStayBucket; entry: "single" | "multiple"; kind: TTravelerKind },
): TGuidedService[] =>
  services.filter((s) => {
    if (!s.showInGuidedChooser || s.stayBucket === null) return false;
    if (s.stayBucket !== answers.stay) return false;
    if (s.travelerKind !== answers.kind) return false;
    if (answers.stay === "transit") return true;
    if (s.entryKind === "either") return true;
    return s.entryKind === answers.entry;
  });

/** Additional-traveller shortlist: stay + kind, both entry types when they exist. */
export const filterPartyVisaOptions = (
  services: TGuidedService[],
  answers: { stay: TStayBucket; kind: TTravelerKind },
): TGuidedService[] =>
  services.filter((s) => {
    if (!s.showInGuidedChooser || s.stayBucket === null) return false;
    if (s.stayBucket !== answers.stay) return false;
    return s.travelerKind === answers.kind;
  });

export const visibleStayBuckets = (services: TGuidedService[]): TStayBucket[] => {
  const have = new Set(
    services.filter((s) => s.showInGuidedChooser && s.stayBucket).map((s) => s.stayBucket!),
  );
  return STAY_BUCKETS.filter((b) => have.has(b));
};

export type TChooserPhase = "stay" | "entry" | "kind" | "results";

/** Stay buttons that actually have catalog options. Never invent empty buckets. */
export const stayOptionsForChooser = (services: TGuidedService[]): TStayBucket[] =>
  visibleStayBuckets(services);

const rowsForStay = (services: TGuidedService[], stay: TStayBucket): TGuidedService[] =>
  services.filter((s) => s.showInGuidedChooser && s.stayBucket === stay);

const rowsForStayAndEntry = (
  services: TGuidedService[],
  stay: TStayBucket,
  entry: "single" | "multiple" | null,
): TGuidedService[] =>
  rowsForStay(services, stay).filter((s) => {
    if (stay === "transit" || entry === null) return true;
    if (s.entryKind === "either") return true;
    return s.entryKind === entry;
  });

const ENTRY_CHOICES = ["single", "multiple"] as const;

/** Frequency buttons that exist for this stay. Transit / entryKind "either" have none. */
export const entryOptionsForStay = (
  services: TGuidedService[],
  stay: TStayBucket,
): Array<"single" | "multiple"> => {
  if (stay === "transit") return [];
  const kinds = new Set(rowsForStay(services, stay).map((s) => s.entryKind));
  return ENTRY_CHOICES.filter((k) => kinds.has(k));
};

export const needsEntryQuestion = (services: TGuidedService[], stay: TStayBucket): boolean =>
  entryOptionsForStay(services, stay).length > 0;

/** When the entry question is skipped, use the only remaining entry kind so the shortlist is not empty. */
export const defaultEntryForStay = (
  services: TGuidedService[],
  stay: TStayBucket,
): "single" | "multiple" => {
  const options = entryOptionsForStay(services, stay);
  if (options.includes("multiple") && !options.includes("single")) return "multiple";
  return "single";
};

export const kindOptionsForStay = (
  services: TGuidedService[],
  stay: TStayBucket,
  entry: "single" | "multiple" | null = null,
): TTravelerKind[] => {
  const kinds = new Set(rowsForStayAndEntry(services, stay, entry).map((s) => s.travelerKind));
  return TRAVELER_KINDS.filter((k) => kinds.has(k));
};

export const needsKindQuestion = (
  services: TGuidedService[],
  stay: TStayBucket,
  entry: "single" | "multiple" | null = null,
): boolean => kindOptionsForStay(services, stay, entry).length > 0;

export const defaultKindForStay = (
  services: TGuidedService[],
  stay: TStayBucket,
  entry: "single" | "multiple" | null = null,
): TTravelerKind => {
  const options = kindOptionsForStay(services, stay, entry);
  if (options.includes("child") && !options.includes("adult")) return "child";
  return "adult";
};

export const nextPhaseAfterStay = (services: TGuidedService[], stay: TStayBucket): TChooserPhase => {
  if (needsEntryQuestion(services, stay)) return "entry";
  const entry = defaultEntryForStay(services, stay);
  if (needsKindQuestion(services, stay, entry)) return "kind";
  return "results";
};

export const nextPhaseAfterEntry = (
  services: TGuidedService[],
  stay: TStayBucket,
  entry: "single" | "multiple",
): TChooserPhase => {
  if (needsKindQuestion(services, stay, entry)) return "kind";
  return "results";
};
