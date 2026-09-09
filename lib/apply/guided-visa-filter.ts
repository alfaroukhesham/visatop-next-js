import { STAY_BUCKETS, type TEntryKind, type TStayBucket, type TTravelerKind } from "@/lib/catalog/guided-choice";

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

export const needsEntryQuestion = (services: TGuidedService[], stay: TStayBucket): boolean => {
  if (stay === "transit") return false;
  const kinds = new Set(
    rowsForStay(services, stay)
      .map((s) => s.entryKind)
      .filter((k) => k !== "either"),
  );
  return kinds.has("single") && kinds.has("multiple");
};

/** When the entry question is skipped, use the only remaining entry kind so the shortlist is not empty. */
export const defaultEntryForStay = (
  services: TGuidedService[],
  stay: TStayBucket,
): "single" | "multiple" => {
  const kinds = new Set(rowsForStay(services, stay).map((s) => s.entryKind));
  if (kinds.has("multiple") && !kinds.has("single")) return "multiple";
  return "single";
};

export const needsKindQuestion = (
  services: TGuidedService[],
  stay: TStayBucket,
  entry: "single" | "multiple" | null = null,
): boolean => {
  const kinds = new Set(rowsForStayAndEntry(services, stay, entry).map((s) => s.travelerKind));
  return kinds.has("adult") && kinds.has("child");
};

export const defaultKindForStay = (
  services: TGuidedService[],
  stay: TStayBucket,
  entry: "single" | "multiple" | null = null,
): TTravelerKind => {
  const kinds = new Set(rowsForStayAndEntry(services, stay, entry).map((s) => s.travelerKind));
  if (kinds.has("child") && !kinds.has("adult")) return "child";
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
