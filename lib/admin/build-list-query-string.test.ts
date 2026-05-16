import { describe, expect, it } from "vitest";
import { buildListQueryString } from "./build-list-query-string";

describe("buildListQueryString", () => {
  it("omits empty values", () => {
    expect(
      buildListQueryString({
        q: "alfarouk",
        status: "",
        payment: undefined,
        page: 0,
        pageSize: 20,
      }),
    ).toBe("?q=alfarouk&page=0&pageSize=20");
  });

  it("includes attention when true", () => {
    expect(buildListQueryString({ attention: true, page: 1 })).toBe("?attention=true&page=1");
  });
});
