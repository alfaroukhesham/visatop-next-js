"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClientButtonLink } from "@/components/client/client-button";
import { ClientNavLink } from "@/components/client/client-nav-link";
import { authClient } from "@/lib/auth-client";
import { useClientAuthStore } from "@/lib/stores/client-auth-store";
import { cn } from "@/lib/utils";

const NAV_BASE: { href: string; label: string; match: (path: string) => boolean }[] = [
  { href: "/", label: "Home", match: (p) => p === "/" },
  {
    href: "/apply/start",
    label: "Apply",
    match: (p) => p.startsWith("/apply") && !p.startsWith("/apply/track"),
  },
  {
    href: "/apply/track",
    label: "Track",
    match: (p) => p.startsWith("/apply/track"),
  },
  { href: "/portal", label: "Portal", match: (p) => p.startsWith("/portal") },
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
  const { data: session, isPending } = authClient.useSession();
  const storeSession = useClientAuthStore((s) => s.session);
  const storePending = useClientAuthStore((s) => s.isPending);
  const setSession = useClientAuthStore((s) => s.setSession);
  const setPending = useClientAuthStore((s) => s.setPending);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPending(isPending);
    setSession((session ?? null) as any);
  }, [isPending, session, setPending, setSession]);

  const nav = useMemo(() => {
    if (storePending) return NAV_BASE;
    if (storeSession) {
      return NAV_BASE;
    }
    return NAV_BASE;
  }, [storePending, storeSession]);

  async function onSignOut() {
    try {
      await (authClient as any).signOut?.();
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
      <div className="mx-auto flex w-full max-w-[calc(1300px+3rem)] flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link
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
        </Link>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" aria-label="Primary">
          {nav.map(({ href, label, match }) => (
            <ClientNavLink key={href} href={href} onInk active={match(path)}>
              {label}
            </ClientNavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {!mounted || storePending ? (
            <div className="flex items-center gap-2" aria-label="Loading account actions">
              <div className="h-9 w-[92px] animate-pulse rounded-md bg-white/10" aria-hidden />
              <div className="h-9 w-[120px] animate-pulse rounded-md bg-white/10" aria-hidden />
            </div>
          ) : storeSession ? (
            <>
              <ClientButtonLink
                href="/portal/client-dashboard"
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
              <ClientButtonLink
                href="/sign-in"
                variant="ghost"
                className="h-9 shrink-0 border border-white/15 px-3 text-xs font-medium text-white hover:border-[#FCCD64]/50 hover:bg-white/5 hover:text-white"
              >
                Sign in
              </ClientButtonLink>
              <ClientButtonLink
                href="/sign-up"
                brand="cta"
                className="h-9 shrink-0 px-3 text-xs font-bold"
              >
                Create account
              </ClientButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
