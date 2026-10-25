import { isTracingExportEnabled } from "@/lib/observability/otlp-endpoint";

/**
 * Starts the NodeSDK only when an OTLP endpoint is configured.
 * Unset endpoint → immediate return, no SDK import, no patches, no export.
 */
export const registerTracing = async (): Promise<void> => {
  if (!isTracingExportEnabled()) return;
  const { startOtelNodeSdk } = await import("./otel-sdk");
  await startOtelNodeSdk();
};

export const shutdownTracing = async (): Promise<void> => {
  if (!isTracingExportEnabled()) return;
  const { shutdownOtelNodeSdk } = await import("./otel-sdk");
  await shutdownOtelNodeSdk();
};
