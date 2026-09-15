import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/get-admin-session";
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
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/sign-in");
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

