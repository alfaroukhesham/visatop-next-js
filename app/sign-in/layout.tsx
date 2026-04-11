import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthFlowSkeleton } from "@/components/auth/auth-flow-skeleton";
import { auth } from "@/lib/auth";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Visatop portal to continue your visa or residency application.",
};

export default async function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const [clientSession, adminSession] = await Promise.all([
    auth.api.getSession({ headers: hdrs }),
    adminAuth.api.getSession({ headers: hdrs }),
  ]);

  if (adminSession) redirect("/admin");
  if (clientSession) redirect("/portal");

  return <Suspense fallback={<AuthFlowSkeleton />}>{children}</Suspense>;
}
