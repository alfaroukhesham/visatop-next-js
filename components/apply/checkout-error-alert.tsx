"use client";

import { AlertTriangle } from "lucide-react";

export function CheckoutErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-error/40 bg-error/5 text-error flex gap-2 rounded-[8px] border px-3 py-3 text-sm leading-relaxed"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
