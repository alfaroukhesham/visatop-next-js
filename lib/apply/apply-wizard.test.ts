import { describe, expect, it } from "vitest";
import {
  abandonStopFromCursor,
  applyWizardHref,
  cursorIsAhead,
  nextApplyScreen,
  parseApplyWizardQuery,
  resolveApplyScreen,
  type TApplyWizardMember,
} from "@/lib/apply/apply-wizard";

const members: TApplyWizardMember[] = [
  { applicationId: "a", hasPassport: false },
  { applicationId: "b", hasPassport: false },
];

describe("resolveApplyScreen", () => {
  it("opens readiness when nothing has been confirmed", () => {
    expect(resolveApplyScreen({ members, cursor: null, requested: null })).toEqual({
      screen: "ready",
      travellerId: null,
    });
  });

  it("opens the passport screen after readiness is confirmed", () => {
    expect(
      resolveApplyScreen({
        members,
        cursor: { screen: "ready", travellerId: null },
        requested: null,
      }),
    ).toEqual({ screen: "passport", travellerId: "a" });
  });

  it("clamps a jump to details when the passport is still missing", () => {
    expect(
      resolveApplyScreen({
        members,
        cursor: { screen: "ready", travellerId: null },
        requested: { screen: "details", travellerId: "a" },
      }),
    ).toEqual({ screen: "passport", travellerId: "a" });
  });

  it("lets the browser return to an earlier screen", () => {
    expect(
      resolveApplyScreen({
        members: [{ applicationId: "a", hasPassport: true }],
        cursor: { screen: "other", travellerId: "a" },
        requested: { screen: "passport", travellerId: "a" },
      }),
    ).toEqual({ screen: "passport", travellerId: "a" });
  });

  it("sends a finished last traveller to payment", () => {
    expect(
      resolveApplyScreen({
        members: [{ applicationId: "a", hasPassport: true }],
        cursor: { screen: "details", travellerId: "a" },
        requested: null,
      }),
    ).toEqual({ screen: "payment", travellerId: null });
  });

  it("opens the next traveller passport after the previous details are confirmed", () => {
    expect(
      resolveApplyScreen({
        members: [
          { applicationId: "a", hasPassport: true },
          { applicationId: "b", hasPassport: false },
        ],
        cursor: { screen: "details", travellerId: "a" },
        requested: null,
      }),
    ).toEqual({ screen: "passport", travellerId: "b" });
  });

  it("pulls a later traveller back when an earlier passport is missing", () => {
    expect(
      resolveApplyScreen({
        members,
        cursor: { screen: "details", travellerId: "a" },
        requested: { screen: "passport", travellerId: "b" },
      }),
    ).toEqual({ screen: "passport", travellerId: "a" });
  });
});

describe("nextApplyScreen", () => {
  it("walks passport, other documents, then details", () => {
    expect(nextApplyScreen(members, { screen: "passport", travellerId: "a" })).toEqual({
      screen: "other",
      travellerId: "a",
    });
    expect(nextApplyScreen(members, { screen: "details", travellerId: "b" })).toEqual({
      screen: "payment",
      travellerId: null,
    });
  });
});

describe("cursorIsAhead", () => {
  it("refuses to rewind a confirmed screen", () => {
    const previous = { screen: "details" as const, travellerId: "a" };
    expect(cursorIsAhead(members, previous, { screen: "passport", travellerId: "a" })).toBe(false);
    expect(cursorIsAhead(members, previous, { screen: "passport", travellerId: "b" })).toBe(true);
  });
});

describe("abandonStopFromCursor", () => {
  it("names the screen the customer has not finished", () => {
    expect(abandonStopFromCursor({ cursor: null, lastTravellerId: "b" })).toBe("ready");
    expect(
      abandonStopFromCursor({
        cursor: { screen: "passport", travellerId: "a" },
        lastTravellerId: "b",
      }),
    ).toBe("other");
    expect(
      abandonStopFromCursor({
        cursor: { screen: "details", travellerId: "a" },
        lastTravellerId: "b",
      }),
    ).toBe("passport");
    expect(
      abandonStopFromCursor({
        cursor: { screen: "details", travellerId: "b" },
        lastTravellerId: "b",
      }),
    ).toBe("pay");
  });
});

describe("applyWizardHref", () => {
  it("keeps screens on the application url and payment on its own page", () => {
    expect(applyWizardHref("a b", { screen: "passport", travellerId: "a b" })).toBe(
      "/apply/applications/a%20b?screen=passport&traveller=a+b",
    );
    expect(applyWizardHref("a", { screen: "payment", travellerId: null })).toBe(
      "/apply/applications/a/payment",
    );
  });

  it("parses a screen query", () => {
    expect(parseApplyWizardQuery("ready", null)).toEqual({ screen: "ready", travellerId: null });
    expect(parseApplyWizardQuery("nope", "a")).toBeNull();
  });
});
