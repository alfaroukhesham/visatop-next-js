import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "test-req-apply-config" }),
}));

import * as actorContext from "@/lib/db/actor-context";
import * as applyConfig from "@/lib/apply/apply-config";
import { GET } from "./route";

describe("GET /api/catalog/apply-config", () => {
  it("returns the public apply config envelope", async () => {
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) =>
      fn({} as never),
    );
    vi.spyOn(applyConfig, "getApplyConfigFromTx").mockResolvedValue({
      partyEnabled: true,
      partyMaxTravelers: 8,
      badges: { allFeesIncluded: "All fees included", noHiddenCharges: "No hidden charges" },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      partyEnabled: true,
      partyMaxTravelers: 8,
      badges: { allFeesIncluded: "All fees included", noHiddenCharges: "No hidden charges" },
    });
    expect(body.data).not.toHaveProperty("draftTtlHours");
    expect(body.data).not.toHaveProperty("affiliate");
    expect(body.data).not.toHaveProperty("fx");
  });
});
