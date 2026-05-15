import { z } from "zod";

export const createDraftBodySchema = z.object({
  nationalityCode: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Nationality code must be two letters")
    .transform((s) => s.toUpperCase()),
  serviceId: z.string().min(1),
  /** Contact email — required at step 2 on the client; optional for signed-in API creates (account email used). */
  guestEmail: z.string().email().max(320).optional(),
  /** Price book for checkout (must match seeded reference + margin currency). */
  catalogCurrency: z.enum(["USD", "AED"]).default("USD"),
});

export type CreateDraftBody = z.infer<typeof createDraftBodySchema>;
