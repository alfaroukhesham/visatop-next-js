import { describe, expect, it } from "vitest";
import {
  ADMIN_FUNNEL_STEPS,
  buildFunnelRows,
  computeChurnTrio,
  uniqueSubjectId,
} from "@/lib/analytics/funnel-metrics";

describe("uniqueSubjectId", () => {
  it("prefers applicationId when present", () => {
    expect(uniqueSubjectId({ sessionId: "s1", applicationId: "app-1" })).toBe("app-1");
    expect(uniqueSubjectId({ sessionId: "s1", applicationId: null })).toBe("s1");
  });
});

describe("buildFunnelRows", () => {
  it("counts unique subjects per ordered step and drop-off", () => {
    const rows = buildFunnelRows([
      { eventName: "application_started", sessionId: "s1", applicationId: null },
      { eventName: "application_started", sessionId: "s1", applicationId: null },
      { eventName: "application_started", sessionId: "s2", applicationId: null },
      { eventName: "visa_selected", sessionId: "s1", applicationId: "a1" },
      { eventName: "payment_succeeded", sessionId: "s1", applicationId: "a1" },
    ]);
    const byName = Object.fromEntries(rows.map((r) => [r.eventName, r]));
    expect(byName.application_started?.count).toBe(2);
    expect(byName.visa_selected?.count).toBe(1);
    expect(byName.payment_succeeded?.count).toBe(1);
    expect(ADMIN_FUNNEL_STEPS[0]?.eventName).toBe("application_started");
    expect(rows[0]?.dropPct).toBeNull();
  });

  it("does not double-count visa_selected when a chooser beacon and server create both fire", () => {
    const rows = buildFunnelRows([
      { eventName: "application_started", sessionId: "s1", applicationId: null },
      { eventName: "visa_selected", sessionId: "s1", applicationId: null },
      { eventName: "visa_selected", sessionId: "server:a1", applicationId: "a1" },
      { eventName: "application_link_saved", sessionId: "server:a1", applicationId: "a1" },
    ]);
    const byName = Object.fromEntries(rows.map((r) => [r.eventName, r]));
    expect(byName.visa_selected?.count).toBe(1);
    expect(byName.application_link_saved?.count).toBe(1);
  });

  it("counts three paid applications from one party checkout", () => {
    const rows = buildFunnelRows([
      { eventName: "payment_succeeded", sessionId: "server:a1", applicationId: "a1" },
      { eventName: "payment_succeeded", sessionId: "server:a2", applicationId: "a2" },
      { eventName: "payment_succeeded", sessionId: "server:a3", applicationId: "a3" },
    ]);
    const byName = Object.fromEntries(rows.map((r) => [r.eventName, r]));
    expect(byName.payment_succeeded?.count).toBe(3);
  });
});

describe("computeChurnTrio", () => {
  it("labels overall abandon, biggest drop, and abandoned drafts", () => {
    const funnel = buildFunnelRows([
      { eventName: "application_started", sessionId: "s1", applicationId: null },
      { eventName: "application_started", sessionId: "s2", applicationId: null },
      { eventName: "visa_selected", sessionId: "s1", applicationId: "a1" },
    ]);
    const churn = computeChurnTrio({
      created: 10,
      paid: 2,
      abandonedDrafts: 7,
      funnel,
    });
    expect(churn.overallAbandonPct).toBe(80);
    expect(churn.abandonedDrafts).toBe(7);
    expect(churn.biggestDrop?.eventName).toBeTruthy();
  });

  it("returns null overall abandon when nothing was created", () => {
    const churn = computeChurnTrio({
      created: 0,
      paid: 0,
      abandonedDrafts: 0,
      funnel: [],
    });
    expect(churn.overallAbandonPct).toBeNull();
    expect(churn.biggestDrop).toBeNull();
  });
});
