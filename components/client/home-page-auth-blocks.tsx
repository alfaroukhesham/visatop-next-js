"use client";

import type { FC } from "react";
import { signOutAction } from "@/app/actions/auth";
import { ClientButton, ClientButtonLink } from "@/components/client/client-button";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import {
  ClientAccountCardSkeleton,
  ClientButtonRowSkeleton,
} from "@/components/client/client-loading";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";

/** “Track application” for guests only; hidden while session is resolving and when signed in. */
export const HomeHeroGuestTrackLink: FC = () => {
  const t = useCustomerT();
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
      {t("home.guestTrackLink")}
    </ClientButtonLink>
  );
};

export const HomeHeroAuthActions: FC = () => {
  const t = useCustomerT();
  const session = useClientAuthStore((s) => s.session);
  const pending = useClientAuthStore((s) => s.isPending);

  if (pending) {
    return <ClientButtonRowSkeleton />;
  }

  if (!session?.user) return null;

  return (
    <>
      <ClientButtonLink href="/portal/track" brand="cta" className="min-w-[148px] justify-center">
        {t("home.signedInApplicationsLink")}
      </ClientButtonLink>
      <form action={signOutAction} className="sm:ml-1">
        <ClientButton
          type="submit"
          brand="white"
          variant="outline"
          className="w-full min-w-[148px] justify-center sm:w-auto"
        >
          {t("header.signOut")}
        </ClientButton>
      </form>
    </>
  );
};

export const HomeAccountCardBody: FC = () => {
  const t = useCustomerT();
  const session = useClientAuthStore((s) => s.session);
  const pending = useClientAuthStore((s) => s.isPending);

  if (pending) {
    return <ClientAccountCardSkeleton />;
  }

  if (session?.user) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("home.accountSignedInAs", { email: session.user.email ?? "" })}
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm leading-relaxed">{t("home.accountGuestBody")}</p>
  );
};
