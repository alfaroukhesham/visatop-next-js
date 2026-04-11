"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-background text-foreground flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center justify-center")}
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
