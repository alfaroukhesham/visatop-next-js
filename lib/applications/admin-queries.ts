import { and, desc, eq, exists, ilike, inArray, not, notInArray, or, sql, count } from "drizzle-orm";
import { type DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  ADMIN_LIST_CARD_FAILURE_CODES,
  ADMIN_LIST_SETTLED_PAYMENT_STATUSES,
  resolveAdminListPaymentStatus,
} from "@/lib/applications/admin-list-status";

export type AdminListParams = {
  attention?: boolean;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listAdminApplications(
  tx: DbTransaction,
  params: AdminListParams
) {
  const conditions = [];

  if (params.attention) {
    conditions.push(eq(schema.application.adminAttentionRequired, true));
  }

  if (params.status) {
    conditions.push(eq(schema.application.applicationStatus, params.status));
  }

  // Keep this EXISTS in sync with `isAdminListCheckoutCreatedAttempt`.
  const settledStatuses = [...ADMIN_LIST_SETTLED_PAYMENT_STATUSES];
  const cardFailureCodes = [...ADMIN_LIST_CARD_FAILURE_CODES];
  const checkoutCreatedAttempt = exists(
    tx
      .select({ id: schema.payment.id })
      .from(schema.payment)
      .where(
        and(
          eq(schema.payment.applicationId, schema.application.id),
          sql`${schema.payment.id} = (
            select p2.id from payment p2
            where p2.application_id = ${schema.application.id}
            order by p2.created_at desc
            limit 1
          )`,
          notInArray(schema.payment.status, settledStatuses),
          sql`not (
            ${schema.payment.status} = 'failed'
            and lower(coalesce(${schema.payment.failureCode}, '')) in (${sql.join(
              cardFailureCodes.map((code) => sql`${code}`),
              sql`, `,
            )})
          )`,
        ),
      ),
  );
  const listCheckoutCreated = sql`(
    ${notInArray(schema.application.paymentStatus, settledStatuses)}
    and ${checkoutCreatedAttempt}
  )`;

  if (params.paymentStatus === "checkout_created") {
    conditions.push(
      or(eq(schema.application.paymentStatus, "checkout_created"), listCheckoutCreated),
    );
  } else if (params.paymentStatus === "unpaid") {
    conditions.push(
      and(eq(schema.application.paymentStatus, "unpaid"), not(listCheckoutCreated)),
    );
  } else if (params.paymentStatus) {
    conditions.push(eq(schema.application.paymentStatus, params.paymentStatus));
  }

  if (params.fulfillmentStatus) {
    conditions.push(eq(schema.application.fulfillmentStatus, params.fulfillmentStatus));
  }

  if (params.search) {
    conditions.push(
      or(
        ilike(schema.application.id, `%${params.search}%`),
        ilike(schema.application.referenceNumber, `%${params.search}%`),
        ilike(schema.application.guestEmail, `%${params.search}%`),
        ilike(schema.application.fullName, `%${params.search}%`),
      ),
    );
  }

  const query = tx
    .select({
      application: schema.application,
      serviceName: schema.visaService.name,
    })
    .from(schema.application)
    .leftJoin(
      schema.visaService,
      eq(schema.application.serviceId, schema.visaService.id),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.application.createdAt))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  const totalQuery = tx
    .select({ value: count() })
    .from(schema.application)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const [rows, [totalResult]] = await Promise.all([query, totalQuery]);

  const partyIds = [
    ...new Set(rows.map((r) => r.application.partyId).filter((p): p is string => !!p)),
  ];
  const partyCounts = new Map<string, number>();
  if (partyIds.length > 0) {
    const countRows = await tx
      .select({ partyId: schema.application.partyId, value: count() })
      .from(schema.application)
      .where(inArray(schema.application.partyId, partyIds))
      .groupBy(schema.application.partyId);
    for (const r of countRows) {
      if (r.partyId) partyCounts.set(r.partyId, r.value);
    }
  }

  const applicationIds = rows.map((r) => r.application.id);
  const latestPaymentByApplicationId = new Map<
    string,
    { status: string; failureCode: string | null }
  >();
  if (applicationIds.length > 0) {
    const paymentRows = await tx
      .select({
        applicationId: schema.payment.applicationId,
        status: schema.payment.status,
        failureCode: schema.payment.failureCode,
      })
      .from(schema.payment)
      .where(inArray(schema.payment.applicationId, applicationIds))
      .orderBy(desc(schema.payment.createdAt));
    for (const paymentRow of paymentRows) {
      if (!latestPaymentByApplicationId.has(paymentRow.applicationId)) {
        latestPaymentByApplicationId.set(paymentRow.applicationId, {
          status: paymentRow.status,
          failureCode: paymentRow.failureCode,
        });
      }
    }
  }

  return {
    items: rows.map((row) => {
      const latestPayment = latestPaymentByApplicationId.get(row.application.id);
      return {
        ...row.application,
        paymentStatus: resolveAdminListPaymentStatus({
          applicationPaymentStatus: row.application.paymentStatus,
          latestPaymentStatus: latestPayment?.status ?? null,
          latestPaymentFailureCode: latestPayment?.failureCode ?? null,
        }),
        serviceName: row.serviceName,
        partyMemberCount: row.application.partyId
          ? (partyCounts.get(row.application.partyId) ?? 1)
          : 1,
      };
    }),
    total: totalResult.value,
  };
}

export async function getAttentionRequiredCount(tx: DbTransaction) {
  const [result] = await tx
    .select({ value: count() })
    .from(schema.application)
    .where(eq(schema.application.adminAttentionRequired, true));
  return result.value;
}
