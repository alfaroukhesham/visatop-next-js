import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/admin-auth";
import { adminSignOutAction } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Admin",
  description:
    "Visatop admin — operations, verification queue, and automation rules.",
};

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({
    headers: hdrs,
  });

  if (!session) {
    const path = hdrs.get("x-pathname") ?? "/admin";
    const callback =
      path.startsWith("/admin") && !path.startsWith("//") ? path : "/admin";
    redirect(`/admin/sign-in?callbackUrl=${encodeURIComponent(callback)}`);
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <form action={adminSignOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
      {children}
    </>
  );
}

