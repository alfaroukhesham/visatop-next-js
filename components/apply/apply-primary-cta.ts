/** One gold primary for every apply step: 48px, 16px, full width on phones, trailing edge from 640px. */
export const APPLY_PRIMARY_CTA_CLASS =
  "order-1 h-12 min-h-12 w-full min-w-0 justify-center whitespace-nowrap px-3 text-base font-semibold normal-case tracking-normal sm:order-2 sm:min-w-40 sm:w-auto";

/** Previous sits under the gold button on phones and on its leading side from 640px. Same desktop min width as the primary. */
export const APPLY_STEP_PREVIOUS_CLASS =
  "order-2 h-12 min-h-12 w-full min-w-0 justify-center px-3 sm:order-1 sm:min-w-40 sm:w-auto";

/** Programmatic focus (tabIndex={-1}) stays invisible until keyboard focus. */
export const APPLY_PROGRAMMATIC_HEADING_CLASS =
  "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary";

export const APPLY_PRIMARY_CTA_ROW_CLASS =
  "flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end";
