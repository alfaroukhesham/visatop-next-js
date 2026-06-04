const MINOR_PER_MAJOR = BigInt(100);

const currencyFormatters = new Map<string, Intl.NumberFormat>();
const plainFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(locale: string, currencyCode: string): Intl.NumberFormat {
  const key = `${locale}\0${currencyCode}`;
  let fmt = currencyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(key, fmt);
  }
  return fmt;
}

function plainFormatter(locale: string): Intl.NumberFormat {
  let fmt = plainFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    });
    plainFormatters.set(locale, fmt);
  }
  return fmt;
}

/** Convert stored minor units (cents/fils) to a major-unit number for display. */
export function minorUnitsToMajor(minor: bigint): number {
  const whole = minor / MINOR_PER_MAJOR;
  const frac = minor % MINOR_PER_MAJOR;
  const sign = minor < BigInt(0) ? -1 : 1;
  const absWhole = whole < BigInt(0) ? -whole : whole;
  return sign * (Number(absWhole) + Number(frac) / 100);
}

export type FormatMinorUnitsOptions = {
  /** BCP 47 locale; defaults to en-US for stable thousands separators. */
  locale?: string;
};

/**
 * Format a minor-unit amount (e.g. 41900 → 419.00 USD) with grouping and two decimals.
 */
export function formatMinorUnitsAmount(
  amountMinor: bigint | number | string | null | undefined,
  currency?: string | null,
  options?: FormatMinorUnitsOptions,
): string {
  if (amountMinor === null || amountMinor === undefined) return "—";

  let minor: bigint;
  try {
    if (typeof amountMinor === "bigint") {
      minor = amountMinor;
    } else if (typeof amountMinor === "number") {
      if (!Number.isFinite(amountMinor)) return "—";
      minor = BigInt(Math.trunc(amountMinor));
    } else {
      const trimmed = amountMinor.trim();
      if (!trimmed) return "—";
      minor = BigInt(trimmed);
    }
  } catch {
    return "—";
  }

  const major = minorUnitsToMajor(minor);
  if (!Number.isFinite(major)) return "—";

  const locale = options?.locale ?? "en-US";
  const currencyCode = currency?.trim().toUpperCase();

  if (currencyCode && /^[A-Z]{3}$/.test(currencyCode)) {
    try {
      return currencyFormatter(locale, currencyCode).format(major);
    } catch {
      /* fall through to plain number + code */
    }
  }

  const formatted = plainFormatter(locale).format(major);

  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}
