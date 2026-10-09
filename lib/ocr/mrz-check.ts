/** ICAO 9303 TD3 MRZ check digits (passport). */

const WEIGHTS = [7, 3, 1] as const;

const charValue = (ch: string): number => {
  const c = ch.toUpperCase();
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  if (c === "<") return 0;
  return -1;
};

export const icaoCheckDigit = (data: string): string => {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const v = charValue(data[i] ?? "");
    if (v < 0) return "";
    sum += v * WEIGHTS[i % 3];
  }
  return String(sum % 10);
};

const normalizeMrzLine = (raw: string | null | undefined): string | null => {
  if (typeof raw !== "string") return null;
  const line = raw.toUpperCase().replace(/\s+/g, "");
  return line.length === 44 ? line : null;
};

export type TMrzFields = {
  passportNumber: string;
  dateOfBirth: string;
  passportExpiryDate: string;
};

/** Visual-zone ISO dates / passport number vs TD3 line 2. */
export const mrzVisualAgrees = (
  mrz: TMrzFields,
  visual: {
    passportNumber?: string | null;
    dateOfBirth?: string | null;
    passportExpiryDate?: string | null;
  },
): boolean => {
  const num = visual.passportNumber?.replace(/[^A-Z0-9]/gi, "").toUpperCase() ?? "";
  const mrzNum = mrz.passportNumber.replace(/</g, "");
  if (num && mrzNum && num !== mrzNum) return false;
  if (visual.dateOfBirth && isoToMrzDate(visual.dateOfBirth) !== mrz.dateOfBirth) return false;
  if (visual.passportExpiryDate && isoToMrzDate(visual.passportExpiryDate) !== mrz.passportExpiryDate) {
    return false;
  }
  return true;
};

const isoToMrzDate = (iso: string): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return `${m[1]!.slice(2)}${m[2]}${m[3]}`;
};

export const parseTd3Line2 = (line2: string): TMrzFields | null => {
  const line = normalizeMrzLine(line2);
  if (!line) return null;
  const passportNumber = line.slice(0, 9);
  const passportCheck = line[9] ?? "";
  const dob = line.slice(13, 19);
  const dobCheck = line[19] ?? "";
  const expiry = line.slice(21, 27);
  const expiryCheck = line[27] ?? "";
  if (icaoCheckDigit(passportNumber) !== passportCheck) return null;
  if (icaoCheckDigit(dob) !== dobCheck) return null;
  if (icaoCheckDigit(expiry) !== expiryCheck) return null;
  return {
    passportNumber,
    dateOfBirth: dob,
    passportExpiryDate: expiry,
  };
};

export const mrzCheckDigitsValid = (
  line1: string | null | undefined,
  line2: string | null | undefined,
): boolean => {
  const l1 = normalizeMrzLine(line1);
  const parsed = parseTd3Line2(line2 ?? "");
  if (!l1 || !parsed) return false;
  if (!l1.startsWith("P")) return false;
  return true;
};
