/**
 * When `APPLY_STEP3_VALIDATION_DISABLED`, step 3 profile fields are optional on
 * the client. Payment readiness requires email (step 2) plus a passport copy
 * per traveller; photo and catalog extras are collected now or chased by ops
 * after payment. Set to `false` to restore full profile + validation gates
 * before checkout.
 */
export const APPLY_STEP3_VALIDATION_DISABLED = true;
