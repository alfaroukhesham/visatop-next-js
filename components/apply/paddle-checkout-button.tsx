"use client";

import { useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PaddleCheckoutButtonProps {
  applicationId: string;
  disabled?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

export function PaddleCheckoutButton({
  applicationId,
  disabled,
  onSuccess,
  onCancel,
  onError,
}: PaddleCheckoutButtonProps) {
  const [isInitializing, setIsInitializing] = useState(false);

  const handleCheckout = async () => {
    setIsInitializing(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      const envelope = await res.json();
      if (!res.ok) {
        throw new Error(envelope.error?.message || "Failed to initiate checkout");
      }

      const { transactionId, clientToken } = envelope.data;

      const paddle = await initializePaddle({
        environment: (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT as any) || "sandbox",
        token: clientToken || process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
        eventCallback: (event) => {
          if (event.name === "checkout.closed") {
            setIsInitializing(false);
            onCancel?.();
          }
          if (event.name === "checkout.completed") {
            setIsInitializing(false);
            onSuccess?.();
          }
        },
      });

      if (!paddle) {
        throw new Error("Failed to initialize Paddle SDK");
      }

      paddle.Checkout.open({
        transactionId,
      });
    } catch (err: any) {
      console.error("Checkout error:", err);
      onError?.(err.message);
      setIsInitializing(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      disabled={disabled || isInitializing}
      className="w-full font-bold h-12 text-lg shadow-lg hover:shadow-xl transition-all"
    >
      {isInitializing ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Preparing Secure Checkout...
        </>
      ) : (
        "Pay & Submit Application"
      )}
    </Button>
  );
}
