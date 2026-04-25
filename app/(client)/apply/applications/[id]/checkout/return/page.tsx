import { CheckoutReturnClient } from "./checkout-return-client";

export default async function CheckoutReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckoutReturnClient applicationId={id} />;
}
