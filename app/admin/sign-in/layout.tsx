import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSignInSkeleton } from "@/components/auth/admin-sign-in-skeleton";
import { auth } from "@/lib/auth";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin sign in",
  description:
    "Sign in to the Visatop admin console for operations and verification.",
};

export default async function AdminSignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const [clientSession, adminSession] = await Promise.all([
    auth.api.getSession({ headers: hdrs }),
    adminAuth.api.getSession({ headers: hdrs }),
  ]);

  if (clientSession) redirect("/portal");
  if (adminSession) redirect("/admin");

  return <Suspense fallback={<AdminSignInSkeleton />}>{children}</Suspense>;
}

