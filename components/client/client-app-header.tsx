"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientHeaderAuthSkeleton } from "@/components/client/client-loading";
import { ClientButtonLink } from "@/components/client/client-button";
import { ClientNavLink } from "@/components/client/client-nav-link";
import { authClient } from "@/lib/auth-client";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";
import { cn } from "@/lib/utils";

function applyNavActive(path: string): boolean {
  return path === "/" || (path.startsWith("/apply") && !path.startsWith("/apply/track"));
}

const NAV_BASE: { href: string; label: string; match: (path: string) => boolean }[] = [
  // { href: "/", label: "Home", match: (p) => p === "/" },
  {
    href: "/",
    label: "Apply",
    match: applyNavActive,
  },
  {
    href: "/apply/track",
    label: "Track",
    match: (p) => p.startsWith("/apply/track"),
  },
  // { href: "/portal", label: "Portal", match: (p) => p.startsWith("/portal") },
];

type Props = {
  className?: string;
};

/**
 * Full-width ink bar + brand nav (yellow 3px hover/active indicator).
 */
export function ClientAppHeader({ className }: Props) {
  const path = usePathname() ?? "";
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const storeSession = useClientAuthStore((s) => s.session);
  const storePending = useClientAuthStore((s) => s.isPending);

  useEffect(() => {
    setMounted(true);
  }, []);

  const nav = NAV_BASE;

  async function onSignOut() {
    try {
      const api = authClient as unknown as { signOut?: () => Promise<unknown> };
      await api.signOut?.();
    } finally {
      router.refresh();
      router.push("/");
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-white/10 bg-[#012031]/98 text-white shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-[#012031]/92",
        className,
      )}
    >
      <div className="mx-auto grid w-full max-w-[calc(1300px+3rem)] grid-cols-[1fr_auto_1fr] items-center gap-4 px-3 py-4 max-sm:grid-cols-1 max-sm:gap-3">
        {/* <Link
          href="/"
          className="group flex min-w-0 items-center gap-3 rounded-md outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#92C0D7]"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-[5px] border border-[#FCCD64]/40 bg-[#FCCD64] text-[#012031] shadow-sm transition-transform duration-200 group-hover:scale-[1.02]"
            aria-hidden
          >
            <span className="font-heading text-lg font-bold leading-none">V</span>
          </span>
          <span className="min-w-0">
            <span className="block font-heading text-lg font-semibold leading-tight tracking-tight text-white">
              Visatop
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#92C0D7]">
              Visa &amp; residency
            </span>
          </span>
        </Link> */}

        <div aria-hidden className="min-w-0 max-sm:hidden" />

        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm max-sm:justify-self-center"
          aria-label="Primary"
        >
          {nav.map(({ href, label, match }) => (
            <ClientNavLink key={href} href={href} onInk active={match(path)}>
              {label}
            </ClientNavLink>
          ))}
        </nav>

        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end justify-self-end gap-x-2 gap-y-1 max-sm:justify-self-center">
          {!mounted || storePending ? (
            <ClientHeaderAuthSkeleton />
          ) : storeSession ? (
            <>
              <span
                className="text-white/90 min-w-0 max-w-[10rem] truncate text-xs sm:max-w-[18rem] sm:text-sm"
                title={
                  storeSession.user.name?.trim() ||
                  storeSession.user.email ||
                  undefined
                }
              >
                Welcome,{" "}
                {storeSession.user.name?.trim() ||
                  storeSession.user.email?.split("@")[0] ||
                  "there"}
              </span>
              <ClientButtonLink
                href="/portal/track"
                brand="cta"
                className="h-9 shrink-0 px-3 text-xs font-bold"
              >
                Account
              </ClientButtonLink>
              <button
                type="button"
                onClick={onSignOut}
                className="h-9 shrink-0 rounded-md border border-white/15 bg-transparent px-3 text-xs font-medium text-white transition-colors hover:border-[#FCCD64]/50 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#92C0D7]"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {/* <ClientButtonLink
                href="/sign-in"
                variant="ghost"
                className="h-9 shrink-0 border border-white/15 px-3 text-xs font-medium text-white hover:border-[#FCCD64]/50 hover:bg-white/5 hover:text-white"
              >
                Sign in
              </ClientButtonLink> */}
              <ClientButtonLink
                href="/sign-in"
                brand="cta"
                className="h-9 shrink-0 px-3 text-xs font-bold"
              >
                Login / Register
              </ClientButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
