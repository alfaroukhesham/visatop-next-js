/** @vitest-environment jsdom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_LAST_STEP_LIVE_HINT,
  ADMIN_LAST_STEP_POLL_MS,
  useAdminApplicationLastStep,
} from "./use-admin-application-last-step";

const initial = {
  fieldLabel: "Stopped at",
  value: "Passport upload",
  secondary: "2 hours ago · 11/5/2026, 4:00:00 PM\nLast activity 2 hours ago · 11/5/2026, 4:00:00 PM",
};

const nextStep = {
  fieldLabel: "Stopped at",
  value: "Checkout started · Ziina",
  secondary: "1 minute ago · 11/5/2026, 5:59:00 PM\nLast activity 1 minute ago · 11/5/2026, 5:59:00 PM",
};

const okEnvelope = (data: typeof nextStep) =>
  JSON.stringify({ ok: true, data, meta: { requestId: "req-1" } });

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
};

describe("useAdminApplicationLastStep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(okEnvelope(nextStep), { status: 200 })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses a single 15 second poll constant", () => {
    expect(ADMIN_LAST_STEP_POLL_MS).toBe(15_000);
    expect(ADMIN_LAST_STEP_LIVE_HINT).toBe("Live applicants updates every 15 seconds");
  });

  it("keeps the server-rendered value until the poll", () => {
    const { result } = renderHook(() =>
      useAdminApplicationLastStep({ applicationId: "app_demo_1", initial }),
    );
    expect(result.current.lastStep).toEqual(initial);
    expect(result.current.fetching).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("replaces only the last-step payload after 15s", async () => {
    const { result } = renderHook(() =>
      useAdminApplicationLastStep({ applicationId: "app_demo_1", initial }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADMIN_LAST_STEP_POLL_MS);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      "/admin/applications/app_demo_1/last-step",
    );
    expect(result.current.lastStep).toEqual(nextStep);
  });

  it("pauses while the tab is hidden and fetches again when it becomes visible", async () => {
    const { result } = renderHook(() =>
      useAdminApplicationLastStep({ applicationId: "app_demo_1", initial }),
    );
    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADMIN_LAST_STEP_POLL_MS * 2);
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.lastStep).toEqual(initial);

    setHidden(false);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.lastStep).toEqual(nextStep);
  });

  it("keeps the last value when a poll fails, then retries on the next tick", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(okEnvelope(nextStep), { status: 200 }))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: { ...nextStep, value: "Paid" },
            meta: { requestId: "req-2" },
          }),
          { status: 200 },
        ),
      );

    const { result } = renderHook(() =>
      useAdminApplicationLastStep({ applicationId: "app_demo_1", initial }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADMIN_LAST_STEP_POLL_MS);
    });
    expect(result.current.lastStep.value).toBe("Checkout started · Ziina");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADMIN_LAST_STEP_POLL_MS);
    });
    expect(result.current.lastStep.value).toBe("Checkout started · Ziina");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADMIN_LAST_STEP_POLL_MS);
    });
    expect(result.current.lastStep.value).toBe("Paid");
  });

  it("manual refresh fetches now and restarts the 15s timer", async () => {
    const { result } = renderHook(() =>
      useAdminApplicationLastStep({ applicationId: "app_demo_1", initial }),
    );
    await act(async () => {
      await result.current.refresh();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.lastStep).toEqual(nextStep);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADMIN_LAST_STEP_POLL_MS - 1);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("clears the interval on unmount", async () => {
    const { unmount } = renderHook(() =>
      useAdminApplicationLastStep({ applicationId: "app_demo_1", initial }),
    );
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ADMIN_LAST_STEP_POLL_MS * 2);
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
