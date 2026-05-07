/**
 * LEGACY PRICING RESOLVER — DEPRECATED
 *
 * This file previously implemented affiliate reference price + margin resolution.
 * The affiliate_reference_price and margin_policy tables have been dropped in
 * migration 0020_catalog_customer_price.sql.
 *
 * All active pricing now uses:
 *   - lib/pricing/resolve-customer-catalog-price.ts  (catalog + checkout)
 *   - lib/pricing/fx-usd-aed.ts                      (FX helpers)
 *   - lib/catalog/queries.ts                          (public catalog)
 *
 * Pure math helpers (pickEffectiveMarginPolicy, pickLatestReferenceRow, etc.)
 * are retained here only to avoid breaking the existing test file while it is
 * being migrated. They will be removed in a follow-up cleanup once the test
 * file is updated.
 *
 * @deprecated Do not import new code from this file.
 */

export type MarginPolicyPickRow = {
  scope: string;
  serviceId: string | null;
  mode: string;
  value: string;
  enabled: boolean;
  updatedAt: Date;
  currency: string;
};

/** @deprecated Pure helper retained for existing tests only. */
export function pickEffectiveMarginPolicy(
  serviceId: string,
  rows: MarginPolicyPickRow[],
  catalogCurrency?: string,
): Pick<MarginPolicyPickRow, "mode" | "value" | "currency"> | null {
  const enabled = rows.filter((r) => r.enabled);
  const scopedRows = catalogCurrency
    ? enabled.filter((r) => r.currency === catalogCurrency)
    : enabled;
  const serviceScoped = scopedRows.filter(
    (r) => r.scope === "service" && r.serviceId === serviceId,
  );
  if (serviceScoped.length) {
    const best = serviceScoped.reduce((a, b) =>
      a.updatedAt >= b.updatedAt ? a : b,
    );
    return { mode: best.mode, value: best.value, currency: best.currency };
  }
  const globals = scopedRows.filter((r) => r.scope === "global");
  if (!globals.length) return null;
  const best = globals.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
  return { mode: best.mode, value: best.value, currency: best.currency };
}

export type ReferencePickRow = {
  amountMinor: bigint;
  currency: string;
  observedAt: Date;
};

/** @deprecated Pure helper retained for existing tests only. */
export function pickLatestReferenceRow(
  rows: ReferencePickRow[],
): ReferencePickRow | null {
  if (!rows.length) return null;
  return rows.reduce((a, b) => (a.observedAt >= b.observedAt ? a : b));
}

/** @deprecated Pure helper retained for existing tests only. */
export function pickCanonicalAffiliateSiteId(
  sites: { id: string; enabled: boolean }[],
  envSiteId: string | undefined,
): string | null {
  if (envSiteId) {
    const match = sites.find((s) => s.id === envSiteId && s.enabled);
    if (match) return match.id;
  }
  const first = sites.find((s) => s.enabled);
  return first?.id ?? null;
}

// DB-touching functions removed — tables dropped in migration 0020.
// resolveCanonicalAffiliateSiteId → removed (affiliateSite table kept but not used for pricing)
// loadMarginPoliciesForService     → removed (margin_policy table dropped)
// batchLatestReferencesForServices → removed (affiliate_reference_price table dropped)
// batchMarginPoliciesForServices   → removed (margin_policy table dropped)
// batchAddonLinesForServices       → removed (addons not used in new pricing path)
// loadReferenceRowsForServiceSite  → removed (affiliate_reference_price table dropped)
// loadAddonMinorTotalsForService   → removed (not used in new pricing path)
// resolveClientDisplayPrice        → removed (replaced by resolveCheckoutTotal)
// resolveAdminPricingBreakdown     → removed (replaced by resolveCheckoutTotal)
