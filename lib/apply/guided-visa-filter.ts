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

export const visibleStayBuckets = (services: TGuidedService[]): TStayBucket[] => {
  const have = new Set(
    services.filter((s) => s.showInGuidedChooser && s.stayBucket).map((s) => s.stayBucket!),
  );
  return STAY_BUCKETS.filter((b) => have.has(b));
};

export type TChooserPhase = "stay" | "entry" | "kind" | "results";

/** Stay buttons from catalog; if none are configured, show every bucket so the question is still answerable. */
export const stayOptionsForChooser = (services: TGuidedService[]): TStayBucket[] => {
  const visible = visibleStayBuckets(services);
  return visible.length > 0 ? visible : [...STAY_BUCKETS];
};

const rowsForStay = (services: TGuidedService[], stay: TStayBucket): TGuidedService[] =>
  services.filter((s) => s.showInGuidedChooser && s.stayBucket === stay);

export const needsEntryQuestion = (services: TGuidedService[], stay: TStayBucket): boolean => {
  if (stay === "transit") return false;
  const kinds = new Set(rowsForStay(services, stay).map((s) => s.entryKind));
  return kinds.size > 1;
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

export const needsKindQuestion = (services: TGuidedService[], stay: TStayBucket): boolean =>
  rowsForStay(services, stay).some((s) => s.travelerKind === "child");

export const nextPhaseAfterStay = (services: TGuidedService[], stay: TStayBucket): TChooserPhase => {
  if (needsEntryQuestion(services, stay)) return "entry";
  if (needsKindQuestion(services, stay)) return "kind";
  return "results";
};

export const nextPhaseAfterEntry = (services: TGuidedService[], stay: TStayBucket): TChooserPhase => {
  if (needsKindQuestion(services, stay)) return "kind";
  return "results";
};
