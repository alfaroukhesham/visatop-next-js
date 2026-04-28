"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { fetchApiEnvelope } from "@/lib/portal/fetch-envelope";
import { apiHref } from "@/lib/app-href";

type AppPoll = { paymentStatus: string };

export function CheckoutReturnClient({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming payment with our servers…");
  const startedAt = useRef(0);
  const nextDelayMs = useRef(1000);

  useEffect(() => {
    if (startedAt.current === 0) {
      startedAt.current = Date.now();
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (fn: () => void) => {
      const delay = Math.min(nextDelayMs.current, 2000);
      nextDelayMs.current = Math.min(nextDelayMs.current + 250, 2000);
      timer = setTimeout(fn, delay);
    };

    async function pollOnce() {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt.current;
      if (elapsed > 120_000) {
        setMessage(
          "This is taking longer than usual. Your payment may still be processing—open your application and refresh, or contact support if the charge appears on your statement.",
        );
        return;
      }

      const res = await fetchApiEnvelope<{ application: AppPoll }>(
        apiHref(`/applications/${encodeURIComponent(applicationId)}`),
      );
      if (cancelled) return;
      if (!res.ok) {
        setMessage(res.error.message);
        return;
      }

      const ps = res.data.application.paymentStatus;
      if (ps === "paid") {
        router.replace(`/apply/applications/${encodeURIComponent(applicationId)}/submitted`);
        return;
      }
      if (ps !== "checkout_created") {
        setMessage(
          "We could not confirm a completed payment yet. Return to your application to check status or try again.",
        );
        return;
      }

      if (!cancelled) schedule(pollOnce);
    }

    void pollOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [applicationId, router]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
      <Loader2 className="text-primary size-10 animate-spin self-center" aria-hidden />
      <p className="text-center text-sm leading-relaxed text-muted-foreground">{message}</p>
      <Link
        href={`/apply/applications/${encodeURIComponent(applicationId)}`}
        className="text-link text-center text-sm font-medium"
      >
        Back to application
      </Link>
    </div>
  );
}
