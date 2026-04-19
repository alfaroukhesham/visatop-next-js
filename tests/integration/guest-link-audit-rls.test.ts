import { describe, it } from "vitest";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { auditLog } from "@/lib/db/schema";

const run =
  process.env.GUEST_LINK_RLS_INTEGRATION === "1" &&
  Boolean(process.env.DATABASE_URL?.trim());

/** Opt-in: wire `GUEST_LINK_RLS_INTEGRATION=1` + `DATABASE_URL` in one CI job to prove migration 0011. */
describe.skipIf(!run)("RLS: audit_log system insert (guest link)", () => {
  it("allows withSystemDbActor to insert audit_log", async () => {
    await withSystemDbActor(async (tx) => {
      await tx.insert(auditLog).values({
        actorType: "system",
        actorId: null,
        action: "guest_link_rls_probe",
        entityType: "application",
        entityId: "00000000-0000-0000-0000-000000000001",
        beforeJson: null,
        afterJson: JSON.stringify({ probe: true }),
      });
    });
  });
});
