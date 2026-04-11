import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "test-req-services" }),
}));

import * as actorContext from "@/lib/db/actor-context";
import * as catalogQueries from "@/lib/catalog/queries";
import { GET } from "./route";

describe("GET /api/catalog/services", () => {
  it("validates nationality query", async () => {
    const res = await GET(
      new Request("http://localhost/api/catalog/services"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects non alpha-2 nationality after normalize", async () => {
    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=USA"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects nationality with non-letters", async () => {
    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=U%24"),
    );
    expect(res.status).toBe(400);
  });

  it("accepts lowercase nationality query (normalized to alpha-2)", async () => {
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) =>
      fn({} as never),
    );
    vi.spyOn(catalogQueries, "listPublicServicesForNationality").mockResolvedValue([]);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=us"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.nationality).toBe("US");
  });

  it("returns services without margin or reference fields", async () => {
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) =>
      fn({} as never),
    );
    vi.spyOn(catalogQueries, "listPublicServicesForNationality").mockResolvedValue([
      {
        id: "svc-1",
        name: "Tourist",
        durationDays: 30,
        entries: "single",
        displayPriceMinor: "12000",
        currency: "USD",
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=US"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const svc = body.data.services[0];
    expect(Object.keys(svc).sort()).toEqual(
      ["currency", "displayPriceMinor", "durationDays", "entries", "id", "name"].sort(),
    );
    expect(svc).not.toHaveProperty("margin");
    expect(svc).not.toHaveProperty("reference");
  });
});
