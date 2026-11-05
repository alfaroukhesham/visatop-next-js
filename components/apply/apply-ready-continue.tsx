"use client";

import { type FC, type ReactNode } from "react";
import { ClientButton } from "@/components/client/client-button";
import { cn } from "@/lib/utils";
import { useApplyJumpAhead } from "./apply-jump-ahead";

interface IApplyReadyContinueProps {
  children: ReactNode;
  onClick: () => void;
}

export const ApplyReadyContinue: FC<IApplyReadyContinueProps> = ({ children, onClick }) => {
  const { pulseContinue, clearPulse } = useApplyJumpAhead();
  return (
    <div
      data-apply-sticky-cta=""
      className="border-border bg-background/95 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:border-t max-md:px-3 max-md:pt-2.5 max-md:pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] max-md:backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
    >
      <ClientButton
        brand="cta"
        className={cn(
          "h-12 min-h-12 w-full normal-case tracking-normal",
          pulseContinue && "apply-continue-pulse",
        )}
        type="button"
        onClick={onClick}
        onAnimationEnd={clearPulse}
      >
        {children}
      </ClientButton>
    </div>
  );
};
