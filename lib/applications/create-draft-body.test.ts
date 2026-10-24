import { describe, expect, it } from "vitest";
import { createDraftBodySchema } from "./create-draft-body";
import { GUEST_EMAIL_REJECTED_MESSAGE } from "@/lib/validation/guest-email";

describe("createDraftBodySchema guest email", () => {
  const base = { nationalityCode: "NG", serviceId: "svc-1" };

  it("accepts a real contact email", () => {
    const parsed = createDraftBodySchema.safeParse({ ...base, guestEmail: "ada@gmail.com" });
    expect(parsed.success).toBe(true);
  });

  it("rejects junk emails with clear copy", () => {
    for (const guestEmail of ["x@x.com", "a@gmail.com", "ada@example.com", "user@test.com"]) {
      const parsed = createDraftBodySchema.safeParse({ ...base, guestEmail });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.flatten().fieldErrors.guestEmail).toContain(GUEST_EMAIL_REJECTED_MESSAGE);
      }
    }
  });
});
