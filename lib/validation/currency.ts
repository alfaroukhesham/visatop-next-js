import { z } from "zod";

/** ISO 4217 alphabetic code; normalized to uppercase. */
export const zIso4217Alpha3 = z
  .string()
  .length(3)
  .regex(/^[A-Za-z]{3}$/, "Currency must be a 3-letter ISO 4217 code")
  .transform((c) => c.toUpperCase());
