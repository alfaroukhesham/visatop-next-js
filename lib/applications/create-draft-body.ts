import { z } from "zod";

export const createDraftBodySchema = z.object({
  nationalityCode: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Nationality code must be two letters")
    .transform((s) => s.toUpperCase()),
  serviceId: z.string().min(1),
  guestEmail: z.string().email().max(320).optional().nullable(),
});

export type CreateDraftBody = z.infer<typeof createDraftBodySchema>;
