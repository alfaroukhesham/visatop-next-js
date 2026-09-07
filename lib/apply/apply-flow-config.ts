/**
 * When `APPLY_STEP3_VALIDATION_DISABLED`, step 3 profile fields are optional on
 * the client. Payment readiness requires email (step 2) plus all required
 * document slots; missing profile fields warn only. Set to `false` to restore
 * full profile + validation gates before checkout.
 */
export const APPLY_STEP3_VALIDATION_DISABLED = true;
