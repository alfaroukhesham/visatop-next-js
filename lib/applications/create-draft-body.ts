import { z } from "zod";
import { zIso4217Alpha3 } from "@/lib/validation/currency";
import { GUEST_EMAIL_REJECTED_MESSAGE, isPlausibleGuestEmail } from "@/lib/validation/guest-email";

const travelerSchema = z.object({
  serviceId: z.string().min(1),
  kind: z.enum(["adult", "child"]).default("adult"),
});

export const createDraftBodySchema = z
  .object({
    nationalityCode: z
      .string()
      .length(2)
      .regex(/^[A-Za-z]{2}$/, "Nationality code must be two letters")
      .transform((s) => s.toUpperCase()),
    serviceId: z.string().min(1).optional(),
    travelers: z.array(travelerSchema).min(1).optional(),
    /** Contact email — required at step 2 on the client; optional for signed-in API creates (account email used). */
    guestEmail: z
      .email()
      .max(320)
      .optional()
      .refine((value) => value === undefined || isPlausibleGuestEmail(value), {
        message: GUEST_EMAIL_REJECTED_MESSAGE,
      }),
    /** Price book for checkout. Server validates visibility + stored local prices. */
    catalogCurrency: zIso4217Alpha3.default("USD"),
  })
  .refine((b) => Boolean(b.travelers?.length || b.serviceId), {
    message: "Choose a service.",
  });

export type CreateDraftBody = z.infer<typeof createDraftBodySchema>;

export type CreateDraftTraveler = { serviceId: string; kind: "adult" | "child" };

/**
 * Normalize the create body into a traveler list. When `travelers` is absent
 * but `serviceId` is present, fall back to a single adult traveler. The first
 * traveler is the primary applicant.
 */
export const normalizeCreateDraftBody = (
  body: CreateDraftBody,
): { travelers: CreateDraftTraveler[] } => {
  const travelers = body.travelers?.length
    ? body.travelers
    : body.serviceId
      ? [{ serviceId: body.serviceId, kind: "adult" as const }]
      : [];
  return { travelers };
}
