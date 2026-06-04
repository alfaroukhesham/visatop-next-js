import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { CheckoutReturnClient } from "./checkout-return-client";

export const metadata: Metadata = {
  title: "Payment confirmation",
  description: "Confirming your visa application payment with Visatop.",
  robots: { index: false, follow: false },
};

export default async function CheckoutReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, hdrs] = await Promise.all([params, headers()]);
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (row?.paymentStatus === "paid") {
    redirect(`/apply/applications/${encodeURIComponent(id)}/submitted`);
  }
  return <CheckoutReturnClient applicationId={id} />;
}
