"use client";

import { signOutAction } from "@/app/actions/auth";
import { ClientButton, ClientButtonLink } from "@/components/client/client-button";
import { CardContent } from "@/components/client/client-card";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";
import { cn } from "@/lib/utils";

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
      <ClientButtonLink href="/portal" brand="cta" className="min-w-[148px] justify-center">
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

type HomeReturningCustomerSectionProps = {
  className?: string;
};

export function HomeReturningCustomerSection({ className }: HomeReturningCustomerSectionProps) {
  const session = useClientAuthStore((s) => s.session);
  const pending = useClientAuthStore((s) => s.isPending);

  if (pending || session?.user) return null;

  return (
    <section
      className={cn(
        "border-secondary/20 relative mx-auto mt-6 w-full max-w-[calc(1300px+3rem)] border-t px-5 pb-24 pt-14 sm:px-8",
        className,
      )}
      aria-label="Sign in or create an account"
    >
      <div className="theme-client-rise border-secondary/35 from-card via-card to-muted/50 mx-auto max-w-2xl rounded-[12px] border-[3px] bg-gradient-to-b p-8 text-center shadow-[0_20px_56px_rgba(1,32,49,0.12)] sm:p-10">
        <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.28em]">Returning customer</p>
        <h3 className="font-heading text-foreground mt-4 text-[clamp(1.5rem,3.5vw,2.25rem)] font-semibold leading-tight tracking-tight">
          One sign-in for every application
        </h3>
        <p className="text-muted-foreground mx-auto mt-4 max-w-[48ch] text-sm leading-relaxed sm:text-base">
          You can still start from the top without an account. After payment, signing in lets you open the same file on
          another phone or laptop.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
          <ClientButtonLink href="/sign-in" brand="blue" className="min-w-[200px] justify-center">
            Sign in
          </ClientButtonLink>
          <ClientButtonLink href="/sign-up" brand="blue" className="min-w-[200px] justify-center">
            Create account
          </ClientButtonLink>
        </div>
      </div>
    </section>
  );
}
