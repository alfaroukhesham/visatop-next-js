import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "test-req-nationalities" }),
}));

import * as actorContext from "@/lib/db/actor-context";
import * as catalogQueries from "@/lib/catalog/queries";
import { GET } from "./route";

describe("GET /api/catalog/nationalities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns envelope with nationalities and echoes request id", async () => {
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) =>
      fn({} as never),
    );
    vi.spyOn(catalogQueries, "listPublicNationalities").mockResolvedValue([
      { code: "US", name: "United States" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.nationalities).toEqual([{ code: "US", name: "United States" }]);
    expect(body.meta.requestId).toBeTruthy();
    expect(res.headers.get("x-request-id")).toBe(body.meta.requestId);
  });
});
