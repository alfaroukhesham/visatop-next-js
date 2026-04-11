/**
 * Server-side helpers for which OAuth providers are configured.
 * Do not import this from client components — pass booleans as props instead.
 */
export function isFacebookOAuthConfigured(): boolean {
  const id = process.env.FACEBOOK_CLIENT_ID?.trim();
  const secret = process.env.FACEBOOK_CLIENT_SECRET?.trim();
  return Boolean(id && secret);
}
