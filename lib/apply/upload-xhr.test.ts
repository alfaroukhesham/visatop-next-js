import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFormDataWithProgress } from "./upload-xhr";

class FakeXHR {
  static instances: FakeXHR[] = [];
  upload = { onprogress: null as ((ev: ProgressEvent) => void) | null };
  timeout = 0;
  withCredentials = false;
  status = 201;
  responseText = JSON.stringify({ ok: true, data: { document: { id: "d1" } } });
  onload: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  opened: { method: string; url: string } | null = null;
  sent: FormData | null = null;
  aborted = false;

  constructor() {
    FakeXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.opened = { method, url };
  }

  setRequestHeader() {}

  send(body: FormData) {
    this.sent = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

describe("uploadFormDataWithProgress", () => {
  afterEach(() => {
    FakeXHR.instances = [];
    vi.unstubAllGlobals();
  });

  it("reports percent from upload progress and returns JSON", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const percents: Array<number | null> = [];
    const form = new FormData();
    form.set("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const pending = uploadFormDataWithProgress({
      url: "/upload",
      formData: form,
      onProgress: (p) => percents.push(p),
    });
    const xhr = FakeXHR.instances[0]!;
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
    xhr.onload?.();
    const result = await pending;
    expect(result).toEqual({
      kind: "complete",
      status: 201,
      json: { ok: true, data: { document: { id: "d1" } } },
    });
    expect(percents).toEqual([50]);
    expect(xhr.withCredentials).toBe(true);
  });

  it("maps abort and timeout", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const abort = new AbortController();
    const pendingAbort = uploadFormDataWithProgress({
      url: "/upload",
      formData: new FormData(),
      signal: abort.signal,
    });
    abort.abort();
    expect(await pendingAbort).toEqual({ kind: "abort" });

    const pendingTimeout = uploadFormDataWithProgress({
      url: "/upload",
      formData: new FormData(),
    });
    FakeXHR.instances[1]!.ontimeout?.();
    expect(await pendingTimeout).toEqual({ kind: "timeout" });
  });
});
