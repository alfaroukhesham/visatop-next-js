export const customerUploadStateLabel = (hasDoc: boolean): "Uploaded" | "Not uploaded yet" =>
  hasDoc ? "Uploaded" : "Not uploaded yet";
