"use client";

import Link from "next/link";
import type { FC, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPLY_PRIMARY_CTA_CLASS,
  APPLY_PRIMARY_CTA_ROW_CLASS,
  APPLY_STEP_PREVIOUS_CLASS,
} from "@/components/apply/apply-primary-cta";

const box =
  "box-border inline-flex h-12 w-full items-center justify-center rounded-[5px] border px-4 text-base font-semibold leading-none no-underline shadow-none transition-colors duration-200 ease-linear focus-visible:!outline-2 focus-visible:!outline-offset-0 disabled:pointer-events-none disabled:opacity-50";

const dismissBox = cn(
  box,
  "border-border bg-white text-foreground hover:border-secondary hover:bg-secondary hover:text-white",
);

const confirmBox = cn(
  box,
  "border-primary bg-primary text-primary-foreground normal-case tracking-normal hover:bg-[#FFE19F]",
);

interface IDoubleDecisionProps {
  dismissLabel: string;
  onDismiss: () => void;
  confirmLabel?: string;
  /** Next.js app path, e.g. `/apply/applications/:id` — do not prefix `basePath`. */
  confirmHref?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmPending?: boolean;
  className?: string;
}

export const DoubleDecision: FC<IDoubleDecisionProps> = ({
  dismissLabel,
  onDismiss,
  confirmLabel,
  confirmHref,
  onConfirm,
  confirmDisabled = false,
  confirmPending = false,
  className,
}) => {
  const hasConfirm = Boolean(confirmLabel && (confirmHref || onConfirm));

  const confirmInner: ReactNode = (
    <>
      {confirmPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
      {confirmLabel}
    </>
  );

  return (
    <div
      data-slot="double-decision"
      className={cn(APPLY_PRIMARY_CTA_ROW_CLASS, className)}
    >
      <button type="button" className={cn(dismissBox, APPLY_STEP_PREVIOUS_CLASS)} onClick={onDismiss}>
        {dismissLabel}
      </button>
      {hasConfirm && confirmHref ? (
        <Link href={confirmHref} className={cn(confirmBox, APPLY_PRIMARY_CTA_CLASS)} aria-disabled={confirmDisabled}>
          {confirmInner}
        </Link>
      ) : null}
      {hasConfirm && !confirmHref && onConfirm ? (
        <button
          type="button"
          className={cn(confirmBox, APPLY_PRIMARY_CTA_CLASS)}
          disabled={confirmDisabled || confirmPending}
          onClick={onConfirm}
        >
          {confirmInner}
        </button>
      ) : null}
    </div>
  );
};
