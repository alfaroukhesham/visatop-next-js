import { describe, expect, it } from "vitest";
import { resolveDocumentRequirements } from "@/lib/apply/document-requirements";
import {
  attachMemberDocumentSlots,
  buildPublicPartyMembers,
  slotsForPartyMember,
} from "./load-party-members";

const app = {
  id: "app-primary",
  partyId: "party-1",
  travelerRole: "primary",
  travelerKind: "adult",
  travelerIndex: 0,
  serviceId: "svc-adult",
};

const rows = [
  {
    applicationId: "app-child",
    travelerRole: "additional",
    travelerKind: "child",
    travelerIndex: 1,
    serviceId: "svc-child",
    serviceName: "Child Visa",
  },
  {
    applicationId: "app-primary",
    travelerRole: "primary",
    travelerKind: "adult",
    travelerIndex: 0,
    serviceId: "svc-adult",
    serviceName: "Adult Visa",
  },
];

describe("buildPublicPartyMembers", () => {
  it("legacy null partyId returns one member", () => {
    const legacy = { ...app, partyId: null };
    expect(buildPublicPartyMembers(legacy, "Adult Visa", [])).toEqual([
      {
        applicationId: "app-primary",
        travelerRole: "primary",
        travelerKind: "adult",
        travelerIndex: 0,
        serviceId: "svc-adult",
        serviceName: "Adult Visa",
      },
    ]);
  });

  it("two travellers return both ordered by travelerIndex", () => {
    const members = buildPublicPartyMembers(app, "Adult Visa", rows);
    expect(members.map((m) => m.applicationId)).toEqual(["app-primary", "app-child"]);
    expect(members[0].travelerRole).toBe("primary");
    expect(members[1].travelerRole).toBe("additional");
    expect(members[1].serviceName).toBe("Child Visa");
  });
});

describe("attachMemberDocumentSlots", () => {
  const base = buildPublicPartyMembers(app, "Adult Visa", rows);

  it("attaches slots per applicationId", () => {
    const extraSlots = resolveDocumentRequirements([
      { documentType: "bank_statement_6m", role: "required" },
    ]);
    const floorOnly = resolveDocumentRequirements([]);
    const attached = attachMemberDocumentSlots(base, {
      "app-primary": floorOnly,
      "app-child": extraSlots,
    });
    expect(attached[0].slots.map((s) => s.key)).toEqual(["passport_copy", "personal_photo"]);
    expect(attached[1].slots.map((s) => s.key)).toEqual([
      "passport_copy",
      "personal_photo",
      "bank_statement_6m",
    ]);
  });

  it("defaults missing id to floor-only slots", () => {
    const attached = attachMemberDocumentSlots(base, {});
    expect(attached.every((m) => m.slots.length === 2)).toBe(true);
    expect(attached[0].slots.map((s) => s.key)).toEqual(["passport_copy", "personal_photo"]);
  });
});

describe("slotsForPartyMember", () => {
  it("returns member slots or floor-only fallback", () => {
    const extraSlots = resolveDocumentRequirements([
      { documentType: "bank_statement_6m", role: "required" },
    ]);
    const members = attachMemberDocumentSlots(buildPublicPartyMembers(app, "Adult Visa", rows), {
      "app-child": extraSlots,
    });
    expect(slotsForPartyMember(members, "app-child").map((s) => s.key)).toContain(
      "bank_statement_6m",
    );
    expect(slotsForPartyMember(members, "unknown-id").map((s) => s.key)).toEqual([
      "passport_copy",
      "personal_photo",
    ]);
  });
});
