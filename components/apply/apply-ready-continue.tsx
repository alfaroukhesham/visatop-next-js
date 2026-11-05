"use client";

import { useEffect, type FC, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ClientButton } from "@/components/client/client-button";
import { useNarrowViewport } from "@/lib/client/use-narrow-viewport";
import { cn } from "@/lib/utils";
import { ensureApplyStickyCtaVisible, useApplyJumpAhead } from "./apply-jump-ahead";

/** Tablets through 1024px (inclusive) get the viewport-fixed bar; 1025px+ stays inline. */
export const APPLY_STICKY_CTA_MAX_WIDTH_PX = 1024;
export const APPLY_STICKY_CTA_MEDIA_QUERY = `(max-width: ${APPLY_STICKY_CTA_MAX_WIDTH_PX}px)`;

/** Exact desktop/inline classes from main (PR #70). Do not restyle this string. */
export const APPLY_READY_CONTINUE_INLINE_CLASS =
  "border-border bg-background/95 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:border-t max-md:px-3 max-md:pt-2.5 max-md:pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] max-md:backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none";

/** Same classes as the inline ready-step Previous button on main. */
export const APPLY_READY_PREVIOUS_CLASS = "h-12 w-full";

/** EN/AR compact bar uses the short Continue label below this width. */
export const APPLY_READY_CONTINUE_FULL_MIN_WIDTH_PX = 360;
export const APPLY_READY_CONTINUE_SHORT_MEDIA_QUERY = `(max-width: ${APPLY_READY_CONTINUE_FULL_MIN_WIDTH_PX - 1}px)`;

export const compactContinueAlwaysShort = (locale: string): boolean =>
  locale === "fr" || locale.toLowerCase().startsWith("fr-");

export const compactContinueShowsShortLabel = (
  alwaysShort: boolean,
  belowFullMinWidth: boolean,
): boolean => alwaysShort || belowFullMinWidth;

interface IApplyReadyContinueProps {
  children: string;
  onClick: () => void;
  previousLabel?: string;
  onPrevious?: () => void;
  compactShortLabel?: string;
  compactAlwaysShort?: boolean;
}

interface IApplyReadyPreviousButtonProps {
  children: ReactNode;
  onClick: () => void;
  hidden?: boolean;
  inline?: boolean;
}

interface IContinueButtonProps {
  children: ReactNode;
  onClick: () => void;
  pulseContinue: boolean;
  clearPulse: () => void;
  accessibleLabel?: string;
}

/** Same outline Previous as the inline ready-step button on main. */
export const ApplyReadyPreviousButton: FC<IApplyReadyPreviousButtonProps> = ({
  children,
  onClick,
  hidden,
  inline,
}) => (
  <ClientButton
    variant="outline"
    brand="white"
    className={APPLY_READY_PREVIOUS_CLASS}
    type="button"
    hidden={hidden}
    data-apply-ready-inline-previous={inline ? "" : undefined}
    onClick={onClick}
  >
    {children}
  </ClientButton>
);

const ContinueButton: FC<IContinueButtonProps> = ({
  children,
  onClick,
  pulseContinue,
  clearPulse,
  accessibleLabel,
}) => (
  <ClientButton
    brand="cta"
    className={cn("h-12 min-h-12 w-full normal-case tracking-normal", pulseContinue && "apply-continue-pulse")}
    type="button"
    aria-label={accessibleLabel}
    onClick={onClick}
    onAnimationEnd={clearPulse}
  >
    <span data-apply-ready-continue-label="">{children}</span>
  </ClientButton>
);

const applyStickyCtaPortalTarget = (): HTMLElement => {
  return document.querySelector<HTMLElement>("[data-ui='client']") ?? document.body;
};

export const ApplyReadyContinue: FC<IApplyReadyContinueProps> = ({
  children,
  onClick,
  previousLabel,
  onPrevious,
  compactShortLabel,
  compactAlwaysShort = false,
}) => {
  const { pulseContinue, clearPulse } = useApplyJumpAhead();
  const compact = useNarrowViewport(APPLY_STICKY_CTA_MEDIA_QUERY);
  const belowFullMinWidth = useNarrowViewport(APPLY_READY_CONTINUE_SHORT_MEDIA_QUERY);
  const compactVisibleLabel =
    compactShortLabel && compactContinueShowsShortLabel(compactAlwaysShort, belowFullMinWidth)
      ? compactShortLabel
      : children;

  useEffect(() => {
    if (!pulseContinue) return;
    ensureApplyStickyCtaVisible();
  }, [pulseContinue]);

  const inlineBar = (
    <div
      hidden={compact}
      data-apply-sticky-cta={compact ? undefined : ""}
      className={APPLY_READY_CONTINUE_INLINE_CLASS}
    >
      <ContinueButton onClick={onClick} pulseContinue={pulseContinue} clearPulse={clearPulse}>
        {children}
      </ContinueButton>
    </div>
  );

  const portalBar =
    compact && typeof document !== "undefined"
      ? createPortal(
          <div
            data-apply-sticky-cta=""
            data-apply-sticky-cta-portal=""
            className="border-border bg-background/95 border-t px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md"
            style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30 }}
          >
            <div className="mx-auto flex w-full max-w-4xl items-stretch gap-2">
              {previousLabel && onPrevious ? (
                <div className="min-w-0 flex-1 [&>*]:min-w-0">
                  <ApplyReadyPreviousButton onClick={onPrevious}>{previousLabel}</ApplyReadyPreviousButton>
                </div>
              ) : null}
              <div className="min-w-0 flex-[2] [&>*]:min-w-0">
                <ContinueButton
                  accessibleLabel={children}
                  onClick={onClick}
                  pulseContinue={pulseContinue}
                  clearPulse={clearPulse}
                >
                  {compactVisibleLabel}
                </ContinueButton>
              </div>
            </div>
          </div>,
          applyStickyCtaPortalTarget(),
        )
      : null;

  return (
    <>
      {compact ? (
        <div aria-hidden data-apply-sticky-cta-spacer="" style={{ height: "5.5rem" }} />
      ) : null}
      {inlineBar}
      {portalBar}
    </>
  );
};
