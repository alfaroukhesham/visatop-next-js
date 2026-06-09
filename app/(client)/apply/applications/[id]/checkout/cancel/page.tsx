import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment cancelled",
  description: "Your payment was not completed. Return to your application to try again when ready.",
};

export default async function CheckoutCancelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enc = encodeURIComponent(id);
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-16">
      <h1 className="font-heading text-center text-lg font-semibold">Payment cancelled</h1>
      <p className="text-center text-sm leading-relaxed text-muted-foreground">
        No charge was completed. You can return to your application to review details or try again when you are
        ready.
      </p>
      <Link
        href={`/apply/applications/${enc}/payment`}
        className="text-link text-center text-sm font-medium"
      >
        Back to payment
      </Link>
    </div>
  );
}
