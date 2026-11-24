import { describe, expect, it } from "vitest";
import type { DbTransaction } from "@/lib/db";
import { planTripUpdate, tripEditsLocked } from "@/lib/checkout-extras/trip-rules";
import { cancelPartyCheckout } from "./cancel-party-checkout";

type TApp = {
  id: string;
  partyId: string;
  checkoutState: string | null;
  paymentStatus: string;
  travelerIndex: number;
};

type TPay = {
  applicationId: string;
  status: string;
};

const collectStrings = (node: unknown, seen = new Set<unknown>(), found: string[] = []): string[] => {
  if (node === "lead" || node === "companion") {
    found.push(node);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  if (seen.has(node)) return found;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, seen, found);
    return found;
  }
  for (const value of Object.values(node)) collectStrings(value, seen, found);
  return found;
};

const createTx = (apps: TApp[], payments: TPay[]) => {
  let selects = 0;
  let updates = 0;
  let rowLocks = 0;
  const tx = {
    select() {
      const call = ++selects;
      const chain = {
        from() {
          return chain;
        },
        where() {
          return chain;
        },
        orderBy() {
          return chain;
        },
        for(mode: string) {
          if (mode === "update") rowLocks += 1;
          return chain;
        },
        limit() {
          return chain;
        },
        then(resolve: (rows: unknown[]) => void) {
          if (call === 1) {
            resolve(apps.filter((app) => app.id === "lead"));
            return;
          }
          resolve([...apps].sort((a, b) => a.travelerIndex - b.travelerIndex));
        },
      };
      return chain;
    },
    update() {
      const call = ++updates;
      return {
        set(values: { checkoutState?: string; paymentStatus?: string; status?: string }) {
          return {
            where(clause: unknown) {
              const ids = collectStrings(clause);
              if (call === 1) {
                for (const app of apps) {
                  if (ids.includes(app.id) && app.checkoutState === "pending") {
                    app.checkoutState = values.checkoutState ?? app.checkoutState;
                    app.paymentStatus = values.paymentStatus ?? app.paymentStatus;
                  }
                }
              } else {
                for (const pay of payments) {
                  if (ids.includes(pay.applicationId) && pay.status === "checkout_created") {
                    pay.status = values.status ?? pay.status;
                  }
                }
              }
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
  return { tx: tx as unknown as DbTransaction, rowLocks: () => rowLocks };
};

describe("cancelPartyCheckout", () => {
  it("releases both travellers when the lead cancels, then the trip patch succeeds", async () => {
    const apps: TApp[] = [
      { id: "lead", partyId: "party-1", checkoutState: "none", paymentStatus: "unpaid", travelerIndex: 0 },
      { id: "companion", partyId: "party-1", checkoutState: "none", paymentStatus: "unpaid", travelerIndex: 1 },
    ];
    const payments: TPay[] = [];

    for (const app of apps) {
      app.checkoutState = "pending";
      app.paymentStatus = "checkout_created";
    }
    payments.push({ applicationId: "lead", status: "checkout_created" });
    expect(tripEditsLocked(apps, payments)).toBe(true);

    const store = createTx(apps, payments);
    const cancelled = await cancelPartyCheckout(store.tx, "lead");
    expect(cancelled).toEqual({ ok: true, releasedIds: ["lead", "companion"] });
    expect(store.rowLocks()).toBe(2);
    expect(apps).toEqual([
      { id: "lead", partyId: "party-1", checkoutState: "none", paymentStatus: "unpaid", travelerIndex: 0 },
      { id: "companion", partyId: "party-1", checkoutState: "none", paymentStatus: "unpaid", travelerIndex: 1 },
    ]);
    expect(payments).toEqual([{ applicationId: "lead", status: "failed" }]);
    expect(tripEditsLocked(apps, payments)).toBe(false);

    const planned = planTripUpdate({
      locked: tripEditsLocked(apps, payments),
      stored: {
        travelDate: "2026-12-20",
        processingSpeed: "standard",
        processingSpeedSource: "system",
        insuranceSelectedByApplicationId: {},
      },
      patch: { travelDate: "2026-12-24", travelInsurance: true },
      memberIds: ["lead", "companion"],
      todayUae: "2026-11-24",
      maxTravelDate: "2027-05-23",
      travelDateRequired: true,
      thresholdDays: 4,
      fastTrackAvailable: true,
      insuranceAvailable: true,
      now: new Date("2026-11-23T20:00:00.000Z"),
    });
    expect(planned.ok).toBe(true);
    expect(planned.ok && planned.abandonCheckout).toBe(false);
    expect(planned.ok && planned.next.travelDate).toBe("2026-12-24");
    expect(planned.ok && planned.next.insuranceSelectedByApplicationId).toEqual({
      lead: true,
      companion: true,
    });
  });
});
