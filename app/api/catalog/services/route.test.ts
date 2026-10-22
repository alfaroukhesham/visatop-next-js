import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-request-id": "test-req-services" }),
}));

import * as actorContext from "@/lib/db/actor-context";
import * as catalogQueries from "@/lib/catalog/queries";
import * as visibleCurrencies from "@/lib/catalog/load-visible-catalog-currencies";
import { GET } from "./route";

const GLOBALS = [
  { code: "USD", kind: "global" as const },
  { code: "AED", kind: "global" as const },
];

describe("GET /api/catalog/services", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validates nationality query", async () => {
    const res = await GET(new Request("http://localhost/api/catalog/services"));
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
    vi.spyOn(visibleCurrencies, "loadVisibleCatalogCurrencies").mockResolvedValue(GLOBALS);
    vi.spyOn(catalogQueries, "listPublicServicesForNationality").mockResolvedValue([]);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=us"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.nationality).toBe("US");
    expect(body.data.currency).toBe("USD");
    expect(body.data.currencies).toEqual(GLOBALS);
  });

  it("rejects a local currency that is not linked to the nationality", async () => {
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) =>
      fn({} as never),
    );
    vi.spyOn(visibleCurrencies, "loadVisibleCatalogCurrencies").mockResolvedValue(GLOBALS);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=US&currency=NGN"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid currency query", async () => {
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) =>
      fn({} as never),
    );
    vi.spyOn(visibleCurrencies, "loadVisibleCatalogCurrencies").mockResolvedValue(GLOBALS);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=US&currency=EUR"),
    );
    expect(res.status).toBe(400);
  });

  it("passes AED to catalog query and echoes currency", async () => {
    const spy = vi.spyOn(catalogQueries, "listPublicServicesForNationality").mockResolvedValue([]);
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) => fn({} as never));
    vi.spyOn(visibleCurrencies, "loadVisibleCatalogCurrencies").mockResolvedValue(GLOBALS);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=US&currency=aed"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.currency).toBe("AED");
    expect(spy.mock.calls[0]?.[2]).toBe("AED");
  });

  it("includes NGN for a linked nationality and defaults to it when a local price exists", async () => {
    const visible = [...GLOBALS, { code: "NGN", kind: "local" as const }];
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) => fn({} as never));
    vi.spyOn(visibleCurrencies, "loadVisibleCatalogCurrencies").mockResolvedValue(visible);
    vi.spyOn(visibleCurrencies, "loadLocalPricedServiceIds").mockResolvedValue(["svc-1"]);
    const spy = vi.spyOn(catalogQueries, "listPublicServicesForNationality").mockResolvedValue([]);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=NG"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.currency).toBe("NGN");
    expect(body.data.localPricedServiceIds).toEqual(["svc-1"]);
    expect(spy.mock.calls[0]?.[2]).toBe("NGN");
  });

  it("passes NGN through when requested by a linked nationality", async () => {
    const visible = [...GLOBALS, { code: "NGN", kind: "local" as const }];
    const spy = vi.spyOn(catalogQueries, "listPublicServicesForNationality").mockResolvedValue([]);
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) => fn({} as never));
    vi.spyOn(visibleCurrencies, "loadVisibleCatalogCurrencies").mockResolvedValue(visible);
    vi.spyOn(visibleCurrencies, "loadLocalPricedServiceIds").mockResolvedValue(["svc-1"]);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=NG&currency=NGN"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.currency).toBe("NGN");
    expect(spy.mock.calls[0]?.[2]).toBe("NGN");
  });

  it("returns services without margin or reference fields", async () => {
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) =>
      fn({} as never),
    );
    vi.spyOn(visibleCurrencies, "loadVisibleCatalogCurrencies").mockResolvedValue(GLOBALS);
    vi.spyOn(catalogQueries, "listPublicServicesForNationality").mockResolvedValue([
      {
        id: "svc-1",
        name: "Tourist",
        durationDays: 30,
        entries: "single",
        displayPriceMinor: "12000",
        currency: "USD",
        documentTypes: [],
        stayBucket: "15_30",
        entryKind: "single",
        travelerKind: "adult",
        showInGuidedChooser: true,
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=US"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.currency).toBe("USD");
    const svc = body.data.services[0];
    expect(Object.keys(svc).sort()).toEqual(
      ["currency", "displayPriceMinor", "documentTypes", "durationDays", "entries", "id", "name", "stayBucket", "entryKind", "travelerKind", "showInGuidedChooser"].sort(),
    );
    expect(svc.documentTypes).toEqual([]);
    expect(svc).not.toHaveProperty("margin");
    expect(svc).not.toHaveProperty("reference");
  });

  it("includes stayBucket on the payload", async () => {
    vi.spyOn(actorContext, "withSystemDbActor").mockImplementation(async (fn) =>
      fn({} as never),
    );
    vi.spyOn(visibleCurrencies, "loadVisibleCatalogCurrencies").mockResolvedValue(GLOBALS);
    vi.spyOn(catalogQueries, "listPublicServicesForNationality").mockResolvedValue([
      {
        id: "svc-1",
        name: "Tourist",
        durationDays: 30,
        entries: "single",
        displayPriceMinor: "12000",
        currency: "USD",
        documentTypes: [],
        stayBucket: "15_30",
        entryKind: "single",
        travelerKind: "adult",
        showInGuidedChooser: true,
      },
    ]);

    const res = await GET(
      new Request("http://localhost/api/catalog/services?nationality=US"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const svc = body.data.services[0];
    expect(svc.stayBucket).toBe("15_30");
  });
});
