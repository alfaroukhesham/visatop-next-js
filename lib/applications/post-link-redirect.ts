/**
 * Post–guest-link navigation.
 *
 * We no longer route users to the legacy portal "workspace" page. After linking,
 * send the user to the track page where they can see status across applications.
 */
export function buildPostLinkLocation(applicationId: string): string {
  void applicationId;
  return "/apply/track";
}
