export const FILE_EXCEEDS_LIMIT_MESSAGE = "File exceeds 8MB limit.";

export const customerUploadStateLabel = (hasDoc: boolean): "Uploaded" | "Not uploaded yet" =>
  hasDoc ? "Uploaded" : "Not uploaded yet";

export const oversizedUploadMessage = (byteLength: number, maxBytes: number): string | null =>
  byteLength > maxBytes ? FILE_EXCEEDS_LIMIT_MESSAGE : null;
