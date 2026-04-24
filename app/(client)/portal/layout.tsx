import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Portal",
  description:
    "Your signed-in area — open the client dashboard or application workspace.",
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
    <>
      <div className="fixed top-4 right-4 z-50">
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
      {children}
    </>
  );
}
