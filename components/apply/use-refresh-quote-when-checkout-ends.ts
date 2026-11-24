"use client";

import { useEffect, useRef } from "react";

/** One refresh when a checkout session ends, whether by cancel, the countdown, or the poll. */
export const useRefreshQuoteWhenCheckoutEnds = (
  paymentStatus: string | null | undefined,
  refreshQuote: (() => void) | undefined,
): void => {
  const sawOpenCheckout = useRef(false);
  useEffect(() => {
    const open = paymentStatus === "checkout_created";
    if (sawOpenCheckout.current && !open) refreshQuote?.();
    sawOpenCheckout.current = open;
  }, [paymentStatus, refreshQuote]);
};
