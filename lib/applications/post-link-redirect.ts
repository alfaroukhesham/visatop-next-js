/**
 * Post–guest-link navigation (spec D1 / D11).
 *
 * When **`WORKSPACE_APPLICATION_HIGHLIGHT_ENABLED`** is **`false`**, the primary
 * workspace highlight path is deferred and we use the slip URL instead
 * (session-owned apply screen).
 */
export function buildPostLinkLocation(applicationId: string): string {
  const flag = process.env.WORKSPACE_APPLICATION_HIGHLIGHT_ENABLED;
  const useWorkspace = flag !== "false";
  if (useWorkspace) {
    return `/portal/application-workspace?applicationId=${encodeURIComponent(applicationId)}`;
  }
  return `/apply/applications/${encodeURIComponent(applicationId)}?linked=1`;
}
