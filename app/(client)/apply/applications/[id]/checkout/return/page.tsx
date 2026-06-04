import type { Metadata } from "next";
import { CheckoutReturnClient } from "./checkout-return-client";

export const metadata: Metadata = {
  title: "Payment confirmation",
  description: "Confirming your visa application payment with Visatop.",
  robots: { index: false, follow: false },
};

export default async function CheckoutReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckoutReturnClient applicationId={id} />;
}
