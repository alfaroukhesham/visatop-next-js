export function isBetterAuthDashEnabled(): boolean {
  return Boolean(process.env.BETTER_AUTH_API_KEY?.trim());
}
