import type { ClientSession } from "@/lib/stores/client-auth-store";

/** Maps Better Auth `useSession` payload into the slim shape kept in `useClientAuthStore`. */
export function toClientSession(input: unknown): ClientSession {
  if (!input || typeof input !== "object") return null;
  const maybe = input as { user?: unknown };
  if (!maybe.user || typeof maybe.user !== "object") return null;
  const u = maybe.user as { id?: unknown; name?: unknown; email?: unknown };
  if (typeof u.id !== "string") return null;
  return {
    user: {
      id: u.id,
      name: typeof u.name === "string" ? u.name : u.name == null ? null : null,
      email: typeof u.email === "string" ? u.email : u.email == null ? null : null,
    },
  };
}
