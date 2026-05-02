"use client";

import { signOutAction } from "@/app/actions/auth";
import { ClientButton, ClientButtonLink } from "@/components/client/client-button";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";

/** “Track application” for guests only; hidden while session is resolving and when signed in. */
export function HomeHeroGuestTrackLink() {
  const session = useClientAuthStore((s) => s.session);
  const pending = useClientAuthStore((s) => s.isPending);

  if (pending || session?.user) return null;

  return (
    <ClientButtonLink
      href="/apply/track"
      variant="outline"
      brand="white"
      className="min-w-[148px] justify-center border-secondary/40 text-secondary hover:bg-secondary/10"
    >
      Track application
    </ClientButtonLink>
  );
}

export function HomeHeroAuthActions() {
  const session = useClientAuthStore((s) => s.session);
  const pending = useClientAuthStore((s) => s.isPending);

  if (pending) {
    return (
      <>
        <div className="h-10 min-w-[148px] animate-pulse rounded-md bg-muted/80" aria-hidden />
        <div className="h-10 min-w-[148px] animate-pulse rounded-md bg-muted/80" aria-hidden />
      </>
    );
  }

  if (!session?.user) return null;

  return (
    <>
      <ClientButtonLink href="/portal/track" brand="cta" className="min-w-[148px] justify-center">
        My applications
      </ClientButtonLink>
      <form action={signOutAction} className="sm:ml-1">
        <ClientButton
          type="submit"
          brand="white"
          variant="outline"
          className="w-full min-w-[148px] justify-center sm:w-auto"
        >
          Sign out
        </ClientButton>
      </form>
    </>
  );
}

export function HomeAccountCardBody() {
  const session = useClientAuthStore((s) => s.session);
  const pending = useClientAuthStore((s) => s.isPending);

  if (pending) {
    return <div className="h-14 w-full animate-pulse rounded-md bg-muted/70" aria-hidden />;
  }

  if (session?.user) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        Signed in as <span className="text-foreground font-semibold">{session.user.email}</span>
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm leading-relaxed">
      Use the nationality form above to start, or sign in from the header or below. If you begin as a guest, complete
      payment and follow the email we send to connect this application to an account.
    </p>
  );
}
