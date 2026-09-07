import { describe, expect, it } from "vitest";
import { buildAdminTravellers } from "./load-application-travellers";

const app = {
  id: "app-primary",
  partyId: "party-1",
  travelerRole: "primary",
  travelerKind: "adult",
  travelerIndex: 0,
  serviceId: "svc-adult",
};

const memberRows = [
  {
    applicationId: "app-child",
    travelerRole: "additional",
    travelerKind: "child",
    travelerIndex: 1,
    serviceName: "Child Visa",
    applicationStatus: "submitted",
    paymentStatus: "paid",
    fulfillmentStatus: "in_progress",
  },
  {
    applicationId: "app-primary",
    travelerRole: "primary",
    travelerKind: "adult",
    travelerIndex: 0,
    serviceName: "Adult Visa",
    applicationStatus: "submitted",
    paymentStatus: "paid",
    fulfillmentStatus: "awaiting_authority",
  },
];

const docRows = [
  {
    applicationId: "app-primary",
    id: "doc-1",
    documentType: "passport_copy",
    status: "retained",
    createdAt: new Date("2026-01-01"),
    originalFilename: "passport.pdf",
    byteLength: 100,
  },
];

describe("buildAdminTravellers", () => {
  it("legacy null partyId returns []", () => {
    const legacy = { ...app, partyId: null };
    expect(buildAdminTravellers(legacy, [], [])).toEqual([]);
  });

  it("two members return both with statuses, ordered by travelerIndex", () => {
    const travellers = buildAdminTravellers(app, memberRows, docRows);
    expect(travellers.map((t) => t.applicationId)).toEqual(["app-primary", "app-child"]);
    expect(travellers[0].travelerRole).toBe("primary");
    expect(travellers[1].travelerRole).toBe("additional");
    expect(travellers[1].serviceName).toBe("Child Visa");
    expect(travellers[1].fulfillmentStatus).toBe("in_progress");
    expect(travellers[0].documents).toHaveLength(1);
    expect(travellers[0].documents[0].documentType).toBe("passport_copy");
    expect(travellers[1].documents).toHaveLength(0);
  });
});
