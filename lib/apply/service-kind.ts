export type TServiceKind = "tourist" | "transit";

export type TServiceKindInput = {
  name: string;
  durationDays: number | null;
};

export const classifyServiceKind = (input: TServiceKindInput): TServiceKind => {
  const name = input.name.trim().toLowerCase();
  if (/\btransit\b/.test(name) || /\b48\s*h/.test(name) || /\b96\s*h/.test(name)) {
    return "transit";
  }
  if (input.durationDays === 2 || input.durationDays === 4) {
    return "transit";
  }
  return "tourist";
};

export const isChildService = (name: string): boolean => {
  const n = name.trim().toLowerCase();
  return /\bchild\b/.test(n) || /\binfant\b/.test(n) || /\bminor\b/.test(n);
};
