import { describe, expect, it, vi } from "vitest";
import { continueWithoutExtras, skipExtrasSave } from "./continue-without-extras";

describe("continue without extras", () => {
  it("saves insurance unticked and opens pay only after that save succeeds", async () => {
    const patchTrip = vi.fn(async () => true);
    const goToPay = vi.fn();
    const saved = await continueWithoutExtras(() => skipExtrasSave(patchTrip), goToPay);
    expect(saved).toBe(true);
    expect(patchTrip).toHaveBeenCalledWith({ insuranceForParty: false });
    expect(goToPay).toHaveBeenCalledOnce();
  });

  it("stays on extras when clearing the tick fails, including a locked checkout", async () => {
    const patchTrip = vi.fn(async () => false);
    const goToPay = vi.fn();
    const saved = await continueWithoutExtras(() => skipExtrasSave(patchTrip), goToPay);
    expect(saved).toBe(false);
    expect(patchTrip).toHaveBeenCalledWith({ insuranceForParty: false });
    expect(goToPay).not.toHaveBeenCalled();
  });
});
