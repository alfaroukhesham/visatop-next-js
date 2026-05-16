import { describe, expect, it } from "vitest";
import {
  adminApplicationsListHref,
  parseAdminApplicationsListParams,
} from "./admin-applications-list-params";

describe("parseAdminApplicationsListParams", () => {
  it("defaults page and page size", () => {
    const parsed = parseAdminApplicationsListParams({});
    expect(parsed.page).toBe(0);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.offset).toBe(0);
    expect(parsed.attention).toBe(false);
  });

  it("parses filters and pagination", () => {
    const parsed = parseAdminApplicationsListParams({
      attention: "true",
      page: "2",
      pageSize: "50",
      q: "  guest@example.com ",
      status: "in_progress",
      payment: "paid",
      fulfillment: "manual_in_progress",
    });
    expect(parsed).toMatchObject({
      attention: true,
      page: 2,
      pageSize: 50,
      offset: 100,
      search: "guest@example.com",
      status: "in_progress",
      paymentStatus: "paid",
      fulfillmentStatus: "manual_in_progress",
    });
  });

  it("ignores invalid enum values", () => {
    const parsed = parseAdminApplicationsListParams({
      status: "not_a_real_status",
      payment: "bogus",
      pageSize: "999",
    });
    expect(parsed.status).toBeUndefined();
    expect(parsed.paymentStatus).toBeUndefined();
    expect(parsed.pageSize).toBe(20);
  });
});

describe("adminApplicationsListHref", () => {
  it("builds bookmarkable query strings", () => {
    expect(
      adminApplicationsListHref(
        { q: "abc", status: "draft", page: "1", pageSize: "50" },
        { page: "2" },
      ),
    ).toBe("/admin/applications?q=abc&status=draft&pageSize=50&page=2");
  });

  it("keeps attention filter when requested", () => {
    expect(adminApplicationsListHref({}, { attention: "true" })).toBe(
      "/admin/applications?attention=true",
    );
  });
});
