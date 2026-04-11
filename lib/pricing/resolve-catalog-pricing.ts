import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";
import { computeDisplayPriceMinor } from "./compute-display-price";

export type MarginPolicyPickRow = {
  scope: string;
  serviceId: string | null;
  mode: string;
  value: string;
  enabled: boolean;
  updatedAt: Date;
  currency: string;
};

/** Deterministic margin resolution: service `scope=service` beats `global`; tie-break `updatedAt`. */
export function pickEffectiveMarginPolicy(
  serviceId: string,
  rows: MarginPolicyPickRow[],
): Pick<MarginPolicyPickRow, "mode" | "value" | "currency"> | null {
  const enabled = rows.filter((r) => r.enabled);
  const serviceScoped = enabled.filter(
    (r) => r.scope === "service" && r.serviceId === serviceId,
  );
  if (serviceScoped.length) {
    const best = serviceScoped.reduce((a, b) =>
      a.updatedAt >= b.updatedAt ? a : b,
    );
    return { mode: best.mode, value: best.value, currency: best.currency };
  }
  const globals = enabled.filter((r) => r.scope === "global");
  if (!globals.length) return null;
  const best = globals.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
  return { mode: best.mode, value: best.value, currency: best.currency };
}

export type ReferencePickRow = {
  amountMinor: bigint;
  currency: string;
  observedAt: Date;
};

export function pickLatestReferenceRow(
  rows: ReferencePickRow[],
): ReferencePickRow | null {
  if (!rows.length) return null;
  return rows.reduce((a, b) => (a.observedAt >= b.observedAt ? a : b));
}

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

type SchemaDb = NeonHttpDatabase<Record<string, never>>;

export async function resolveCanonicalAffiliateSiteId(
  tx: SchemaDb,
): Promise<string | null> {
  const sites = await tx
    .select({
      id: schema.affiliateSite.id,
      enabled: schema.affiliateSite.enabled,
    })
    .from(schema.affiliateSite);
  const env = process.env.PRICING_AFFILIATE_SITE_ID?.trim() || undefined;
  return pickCanonicalAffiliateSiteId(sites, env);
}

export async function loadMarginPoliciesForService(
  tx: SchemaDb,
  serviceId: string,
): Promise<MarginPolicyPickRow[]> {
  const rows = await tx
    .select({
      scope: schema.marginPolicy.scope,
      serviceId: schema.marginPolicy.serviceId,
      mode: schema.marginPolicy.mode,
      value: schema.marginPolicy.value,
      enabled: schema.marginPolicy.enabled,
      updatedAt: schema.marginPolicy.updatedAt,
      currency: schema.marginPolicy.currency,
    })
    .from(schema.marginPolicy)
    .where(
      and(
        eq(schema.marginPolicy.enabled, true),
        or(
          and(
            eq(schema.marginPolicy.scope, "global"),
            isNull(schema.marginPolicy.serviceId),
          ),
          and(
            eq(schema.marginPolicy.scope, "service"),
            eq(schema.marginPolicy.serviceId, serviceId),
          ),
        ),
      ),
    );

  return rows.map((r) => ({
    scope: r.scope,
    serviceId: r.serviceId,
    mode: r.mode,
    value: String(r.value),
    enabled: r.enabled,
    updatedAt: r.updatedAt,
    currency: r.currency,
  }));
}

/** Latest reference row per service for a site (by `observed_at` desc). */
export async function batchLatestReferencesForServices(
  tx: SchemaDb,
  siteId: string,
  serviceIds: string[],
): Promise<Map<string, ReferencePickRow>> {
  const map = new Map<string, ReferencePickRow>();
  if (!serviceIds.length) return map;

  const rows = await tx
    .select({
      serviceId: schema.affiliateReferencePrice.serviceId,
      amount: schema.affiliateReferencePrice.amount,
      currency: schema.affiliateReferencePrice.currency,
      observedAt: schema.affiliateReferencePrice.observedAt,
    })
    .from(schema.affiliateReferencePrice)
    .where(
      and(
        eq(schema.affiliateReferencePrice.siteId, siteId),
        inArray(schema.affiliateReferencePrice.serviceId, serviceIds),
      ),
    )
    .orderBy(desc(schema.affiliateReferencePrice.observedAt));

  for (const r of rows) {
    if (map.has(r.serviceId)) continue;
    map.set(r.serviceId, {
      amountMinor: BigInt(r.amount),
      currency: r.currency,
      observedAt: r.observedAt,
    });
  }
  return map;
}

export async function batchMarginPoliciesForServices(
  tx: SchemaDb,
  serviceIds: string[],
): Promise<MarginPolicyPickRow[]> {
  if (!serviceIds.length) return [];

  const rows = await tx
    .select({
      scope: schema.marginPolicy.scope,
      serviceId: schema.marginPolicy.serviceId,
      mode: schema.marginPolicy.mode,
      value: schema.marginPolicy.value,
      enabled: schema.marginPolicy.enabled,
      updatedAt: schema.marginPolicy.updatedAt,
      currency: schema.marginPolicy.currency,
    })
    .from(schema.marginPolicy)
    .where(
      and(
        eq(schema.marginPolicy.enabled, true),
        or(
          and(
            eq(schema.marginPolicy.scope, "global"),
            isNull(schema.marginPolicy.serviceId),
          ),
          and(
            eq(schema.marginPolicy.scope, "service"),
            inArray(schema.marginPolicy.serviceId, serviceIds),
          ),
        ),
      ),
    );

  return rows.map((r) => ({
    scope: r.scope,
    serviceId: r.serviceId,
    mode: r.mode,
    value: String(r.value),
    enabled: r.enabled,
    updatedAt: r.updatedAt,
    currency: r.currency,
  }));
}

export type AddonLineRow = {
  serviceId: string;
  amount: bigint;
  currency: string;
};

export async function batchAddonLinesForServices(
  tx: SchemaDb,
  serviceIds: string[],
): Promise<AddonLineRow[]> {
  if (!serviceIds.length) return [];

  const rows = await tx
    .select({
      serviceId: schema.visaServiceAddon.serviceId,
      amount: schema.addon.amount,
      currency: schema.addon.currency,
    })
    .from(schema.visaServiceAddon)
    .innerJoin(schema.addon, eq(schema.visaServiceAddon.addonId, schema.addon.id))
    .where(
      and(
        inArray(schema.visaServiceAddon.serviceId, serviceIds),
        eq(schema.addon.enabled, true),
      ),
    );

  return rows.map((r) => ({
    serviceId: r.serviceId,
    amount: r.amount,
    currency: r.currency,
  }));
}

export async function loadReferenceRowsForServiceSite(
  tx: SchemaDb,
  serviceId: string,
  siteId: string,
): Promise<ReferencePickRow[]> {
  const rows = await tx
    .select({
      amount: schema.affiliateReferencePrice.amount,
      currency: schema.affiliateReferencePrice.currency,
      observedAt: schema.affiliateReferencePrice.observedAt,
    })
    .from(schema.affiliateReferencePrice)
    .where(
      and(
        eq(schema.affiliateReferencePrice.serviceId, serviceId),
        eq(schema.affiliateReferencePrice.siteId, siteId),
      ),
    )
    .orderBy(desc(schema.affiliateReferencePrice.observedAt));

  return rows.map((r) => ({
    amountMinor: BigInt(r.amount),
    currency: r.currency,
    observedAt: r.observedAt,
  }));
}

/** Addon line amounts (minor) for a service matching reference currency. */
export async function loadAddonMinorTotalsForService(
  tx: SchemaDb,
  serviceId: string,
  referenceCurrency: string,
): Promise<bigint[]> {
  const rows = await tx
    .select({
      amount: schema.addon.amount,
    })
    .from(schema.visaServiceAddon)
    .innerJoin(schema.addon, eq(schema.visaServiceAddon.addonId, schema.addon.id))
    .where(
      and(
        eq(schema.visaServiceAddon.serviceId, serviceId),
        eq(schema.addon.enabled, true),
        eq(schema.addon.currency, referenceCurrency),
      ),
    );

  return rows.map((r) => r.amount);
}

export type ClientDisplayPrice = {
  displayMinor: bigint;
  currency: string;
};

export type ResolveClientDisplayPriceOptions = {
  /** When set, skips querying `affiliate_site` (caller resolved canonical site once). */
  canonicalSiteId?: string | null;
};

/**
 * Computes client-visible total for a service (no cost/margin breakdown).
 * Returns null when no reference price, no margin, margin/addon currency mismatches reference, or invalid margin mode.
 */
export async function resolveClientDisplayPrice(
  tx: SchemaDb,
  serviceId: string,
  options?: ResolveClientDisplayPriceOptions,
): Promise<ClientDisplayPrice | null> {
  let siteId: string | null;
  if (options && "canonicalSiteId" in options) {
    siteId = options.canonicalSiteId ?? null;
  } else {
    siteId = await resolveCanonicalAffiliateSiteId(tx);
  }
  if (!siteId) return null;

  const refRows = await loadReferenceRowsForServiceSite(tx, serviceId, siteId);
  const latest = pickLatestReferenceRow(refRows);
  if (!latest) return null;

  const marginRows = await loadMarginPoliciesForService(tx, serviceId);
  const margin = pickEffectiveMarginPolicy(serviceId, marginRows);
  if (!margin || (margin.mode !== "percent" && margin.mode !== "fixed")) {
    return null;
  }
  if (margin.currency !== latest.currency) {
    return null;
  }

  const addonMinorUnits = await loadAddonMinorTotalsForService(
    tx,
    serviceId,
    latest.currency,
  );
  const { totalMinor } = computeDisplayPriceMinor({
    referenceMinor: latest.amountMinor,
    marginMode: margin.mode,
    marginValue: margin.value,
    addonMinorUnits,
    discountMinor: BigInt(0),
  });

  return { displayMinor: totalMinor, currency: latest.currency };
}

export type AdminPricingBreakdown = ClientDisplayPrice & {
  referenceMinor: bigint;
  marginMode: string;
  marginValue: string;
  addonsMinor: bigint;
};

export async function resolveAdminPricingBreakdown(
  tx: SchemaDb,
  serviceId: string,
  options?: ResolveClientDisplayPriceOptions,
): Promise<AdminPricingBreakdown | null> {
  let siteId: string | null;
  if (options && "canonicalSiteId" in options) {
    siteId = options.canonicalSiteId ?? null;
  } else {
    siteId = await resolveCanonicalAffiliateSiteId(tx);
  }
  if (!siteId) return null;
  const refRows = await loadReferenceRowsForServiceSite(tx, serviceId, siteId);
  const latest = pickLatestReferenceRow(refRows);
  if (!latest) return null;
  const marginRows = await loadMarginPoliciesForService(tx, serviceId);
  const margin = pickEffectiveMarginPolicy(serviceId, marginRows);
  if (!margin || (margin.mode !== "percent" && margin.mode !== "fixed"))
    return null;
  if (margin.currency !== latest.currency) {
    return null;
  }
  const addonMinorUnits = await loadAddonMinorTotalsForService(
    tx,
    serviceId,
    latest.currency,
  );
  const computed = computeDisplayPriceMinor({
    referenceMinor: latest.amountMinor,
    marginMode: margin.mode,
    marginValue: margin.value,
    addonMinorUnits,
    discountMinor: BigInt(0),
  });
  return {
    displayMinor: computed.totalMinor,
    currency: latest.currency,
    referenceMinor: latest.amountMinor,
    marginMode: margin.mode,
    marginValue: margin.value,
    addonsMinor: computed.addonsMinor,
  };
}
