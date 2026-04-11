import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-muted-foreground text-xs tracking-wider uppercase">404</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          This page doesn&apos;t exist or the link may be incorrect.
        </p>
        <Link href="/" className={cn(buttonVariants(), "inline-flex")}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
