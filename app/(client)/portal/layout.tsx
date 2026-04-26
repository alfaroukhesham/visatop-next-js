import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";
import { ClientPortalHeader } from "@/components/client/client-portal-header";

export const metadata: Metadata = {
  title: "Portal | Visatop",
  description: "Signed-in area to start a new visa, open your dashboard, or continue an existing application.",
};

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const session = await auth.api.getSession({
    headers: hdrs,
  });

  if (!session) {
    const path = hdrs.get("x-pathname") ?? "/portal";
    const callback =
      path.startsWith("/portal") && !path.startsWith("//") ? path : "/portal";
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(callback)}`);
  }

  return (
    <div className="text-foreground flex min-h-0 flex-1 flex-col">
      <ClientPortalHeader signOutAction={signOutAction} />
      {children}
    </div>
  );
}
