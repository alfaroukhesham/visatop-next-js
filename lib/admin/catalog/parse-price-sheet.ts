/**
 * Pure functions for parsing the Visatop admin price sheet (XLSX).
 *
 * Template format (Price_template_v01.xlsx family):
 *   Row N: #  | Country | [Service name] | [Service name] | ...
 *   Row N+1+: row number | nationality name | amount | amount | ...
 *
 * Header row is detected, not assumed fixed.
 */

/** Maximum number of rows scanned looking for the header row. */
export const HEADER_SCAN_LIMIT = 25;

/** Minimum extra columns (beyond # and Country) required to consider a row the header. */
const MIN_SERVICE_COLS = 1;

export type RawRow = (string | number | null | undefined)[];

/**
 * Normalise a cell value to a trimmed lowercase string for header matching.
 */
function normHeader(v: string | number | null | undefined): string {
  if (v == null) return "";
  return String(v).trim().toLowerCase();
}

/**
 * Detect the zero-based index of the header row by scanning up to HEADER_SCAN_LIMIT rows.
 *
 * A valid header row must contain (case-insensitive, trimmed):
 *   - A cell equal to "#"
 *   - A cell equal to "country"
 *   - At least MIN_SERVICE_COLS other non-empty cells
 *
 * Returns -1 if not found.
 */
export function detectHeaderRowIndex(rows: RawRow[]): number {
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    const normed = row.map(normHeader);
    const hasHash = normed.some((v) => v === "#");
    const hasCountry = normed.some((v) => v === "country");
    if (!hasHash || !hasCountry) continue;
    // Count non-empty cells that are neither # nor country
    const extras = normed.filter(
      (v) => v && v !== "#" && v !== "country",
    ).length;
    if (extras >= MIN_SERVICE_COLS) return i;
  }
  return -1;
}

/**
 * Normalise a country name for matching purposes.
 * Lowercases, strips diacritics (via NFKD), trims whitespace.
 */
export function normalizeCountryName(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacriticals
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Match a raw country cell value to a nationality code.
 * `nationalityMap` maps normalized name → nationality code (e.g. "indian" → "IN").
 * Returns the code string or null if unresolved.
 */
export function matchNationality(
  raw: string | number | null | undefined,
  nationalityMap: Map<string, string>,
): string | null {
  if (raw == null || raw === "") return null;
  const norm = normalizeCountryName(String(raw));
  return nationalityMap.get(norm) ?? null;
}

// ─── Currency detection ─────────────────────────────────────────────────────

const USD_SIGNALS = ["usd", "$", "us dollar", "us dollars", "dollar", "dollars"];
const AED_SIGNALS = [
  "aed",
  "د.إ",
  "dh",
  "dhs",
  "aed dirham",
  "emirati dirham",
  "dirham",
  "dirhams",
];

/**
 * Attempt to parse a currency code from raw cell text.
 * Returns "USD", "AED", or null.
 */
export function parseCurrencySignal(
  raw: string,
): "USD" | "AED" | null {
  const lower = raw.toLowerCase();
  if (USD_SIGNALS.some((s) => lower.includes(s))) return "USD";
  if (AED_SIGNALS.some((s) => lower.includes(s))) return "AED";
  return null;
}

/**
 * Strip currency signals from a string and extract a numeric value.
 * Handles common formats: "USD 150", "$150.00", "AED 550,00", "1,234.56 AED"
 * Returns the parsed float or null if no number found.
 */
export function extractNumericValue(raw: string): number | null {
  // Strip known currency signal words/symbols
  let cleaned = raw
    .replace(/usd|aed|dh|dhs|د\.إ/gi, "")
    .replace(/[,$]/g, "")
    .trim();

  // If after stripping we have something like "1 234" (space-separated thousands)
  cleaned = cleaned.replace(/\s+/g, "");

  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Convert a float dollar/dirham value to minor units (cents/fils).
 * Rounds half-up to nearest integer.
 */
export function toMinorUnits(value: number): bigint {
  return BigInt(Math.round((value + Number.EPSILON) * 100));
}

export type MoneyCellResult =
  | { kind: "priced"; currency: "USD" | "AED"; amountMinor: bigint }
  | { kind: "ambiguous"; amountMinor: bigint } // amount parsed, currency unknown
  | { kind: "empty" }; // no parseable amount

/**
 * Parse a price cell value into a typed result.
 *
 * Rules:
 * - null / undefined / blank string → "empty"
 * - numeric with currency signal → "priced"
 * - numeric without currency signal → "ambiguous" (amount but no currency)
 * - non-numeric → "empty"
 */
export function parseMoneyCell(
  raw: string | number | null | undefined,
): MoneyCellResult {
  if (raw == null) return { kind: "empty" };

  // Numeric cell (e.g. ExcelJS already parsed as number)
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return { kind: "empty" };
    if (raw === 0) return { kind: "empty" };
    return { kind: "ambiguous", amountMinor: toMinorUnits(raw) };
  }

  const str = String(raw).trim();
  if (!str) return { kind: "empty" };

  const currency = parseCurrencySignal(str);
  const numericValue = extractNumericValue(str);

  if (numericValue === null || numericValue === 0) return { kind: "empty" };
  const amountMinor = toMinorUnits(numericValue);

  if (currency) {
    return { kind: "priced", currency, amountMinor };
  }
  // Numeric value but no currency signal
  return { kind: "ambiguous", amountMinor };
}

// ─── Header column extraction ────────────────────────────────────────────────

export type ParsedHeader = {
  /** Zero-based column index of the '#' column. */
  hashColIdx: number;
  /** Zero-based column index of the 'Country' column. */
  countryColIdx: number;
  /**
   * Ordered list of service columns (by their position in the header row).
   * colIdx is zero-based.
   */
  serviceColumns: Array<{ colIdx: number; rawName: string; trimmedName: string }>;
};

/**
 * Parse the detected header row into a structured descriptor.
 * Assumes `detectHeaderRowIndex` has already confirmed this is the header row.
 */
export function parseHeaderRow(row: RawRow): ParsedHeader {
  let hashColIdx = -1;
  let countryColIdx = -1;
  const serviceColumns: ParsedHeader["serviceColumns"] = [];

  for (let i = 0; i < row.length; i++) {
    const norm = normHeader(row[i]);
    if (norm === "#") {
      hashColIdx = i;
    } else if (norm === "country") {
      countryColIdx = i;
    } else if (norm) {
      serviceColumns.push({
        colIdx: i,
        rawName: String(row[i] ?? "").trim(),
        trimmedName: String(row[i] ?? "").trim(),
      });
    }
  }

  return { hashColIdx, countryColIdx, serviceColumns };
}
