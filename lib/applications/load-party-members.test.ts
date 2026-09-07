import { describe, expect, it } from "vitest";
import { buildPublicPartyMembers } from "./load-party-members";

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
