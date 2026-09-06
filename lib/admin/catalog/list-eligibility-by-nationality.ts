import { asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type TEligibilityPickerCountry = {
  code: string;
  name: string;
  services: Array<{ id: string; name: string; hasPrice: boolean }>;
};

const pairKey = (nationalityCode: string, serviceId: string): string =>
  `${nationalityCode}:${serviceId}`;

export async function listEligibilityByNationality(
  tx: DbTransaction,
): Promise<TEligibilityPickerCountry[]> {
  const [nationalities, eligibility, prices] = await Promise.all([
    tx
      .select({ code: schema.nationality.code, name: schema.nationality.name })
      .from(schema.nationality)
      .orderBy(asc(schema.nationality.name)),
    tx
      .select({
        serviceId: schema.visaServiceEligibility.serviceId,
        nationalityCode: schema.visaServiceEligibility.nationalityCode,
        serviceName: schema.visaService.name,
      })
      .from(schema.visaServiceEligibility)
      .innerJoin(
        schema.visaService,
        eq(schema.visaService.id, schema.visaServiceEligibility.serviceId),
      ),
    tx
      .selectDistinct({
        nationalityCode: schema.catalogCustomerPrice.nationalityCode,
        serviceId: schema.catalogCustomerPrice.serviceId,
      })
      .from(schema.catalogCustomerPrice),
  ]);

  const priceSet = new Set(prices.map((p) => pairKey(p.nationalityCode, p.serviceId)));
  const servicesByCountry = new Map<
    string,
    Array<{ id: string; name: string; hasPrice: boolean }>
  >();
  for (const row of eligibility) {
    const list = servicesByCountry.get(row.nationalityCode) ?? [];
    list.push({
      id: row.serviceId,
      name: row.serviceName,
      hasPrice: priceSet.has(pairKey(row.nationalityCode, row.serviceId)),
    });
    servicesByCountry.set(row.nationalityCode, list);
  }

  return nationalities.map((n) => ({
    code: n.code,
    name: n.name,
    services: servicesByCountry.get(n.code) ?? [],
  }));
}
