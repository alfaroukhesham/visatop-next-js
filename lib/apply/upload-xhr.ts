export const UPLOAD_TIMEOUT_MS = 90_000;

export type TUploadXhrComplete = {
  kind: "complete";
  status: number;
  json: unknown | null;
};

export type TUploadXhrTransportError = {
  kind: "timeout" | "abort" | "network";
};

export type TUploadXhrResult = TUploadXhrComplete | TUploadXhrTransportError;

export type TUploadProgressHandler = (percent: number | null) => void;

const parseJson = (text: string): unknown | null => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

/** POST multipart with upload percent, abort, and a hard timeout. XHR is required for progress. */
export const uploadFormDataWithProgress = (input: {
  url: string;
  formData: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: TUploadProgressHandler;
}): Promise<TUploadXhrResult> => {
  const timeoutMs = input.timeoutMs ?? UPLOAD_TIMEOUT_MS;

  return new Promise((resolve) => {
    if (input.signal?.aborted) {
      resolve({ kind: "abort" });
      return;
    }

    const xhr = new XMLHttpRequest();
    let settled = false;
    const settle = (result: TUploadXhrResult) => {
      if (settled) return;
      settled = true;
      input.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const onAbort = () => {
      xhr.abort();
    };

    xhr.open("POST", input.url);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (event) => {
      if (!input.onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        input.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        return;
      }
      input.onProgress(null);
    };

    xhr.onload = () => {
      settle({
        kind: "complete",
        status: xhr.status,
        json: parseJson(xhr.responseText),
      });
    };
    xhr.ontimeout = () => settle({ kind: "timeout" });
    xhr.onabort = () => settle({ kind: "abort" });
    xhr.onerror = () => settle({ kind: "network" });

    input.signal?.addEventListener("abort", onAbort);
    xhr.send(input.formData);
  });
};
