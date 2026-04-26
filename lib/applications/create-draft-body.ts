import { z } from "zod";

export const createDraftBodySchema = z.object({
  nationalityCode: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Nationality code must be two letters")
    .transform((s) => s.toUpperCase()),
  serviceId: z.string().min(1),
  /** Required for guest drafts (enforced in route); optional for signed-in users. */
  guestEmail: z.string().email().max(320).optional().nullable(),
  /** Price book for checkout (must match seeded reference + margin currency). */
  catalogCurrency: z.enum(["USD", "AED"]).default("USD"),
});

export type CreateDraftBody = z.infer<typeof createDraftBodySchema>;
