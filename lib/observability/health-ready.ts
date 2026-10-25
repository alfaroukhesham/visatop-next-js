import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getActivePaymentProvider } from "@/lib/payments/resolve-payment-provider";

export type TReadinessChecks = {
  database: boolean;
  payment: boolean;
  ocr: boolean;
};

export type TReadinessDeps = {
  pingDatabase?: () => Promise<boolean>;
  paymentConfigured?: () => boolean;
  ocrConfigured?: () => boolean;
};

const envPresent = (name: string): boolean => Boolean(process.env[name]?.trim());

export const isPaymentConfigPresent = (): boolean => {
  if (getActivePaymentProvider() === "ziina") {
    return envPresent("ZIINA_ACCESS_TOKEN") && envPresent("ZIINA_WEBHOOK_SECRET");
  }
  return envPresent("PADDLE_API_KEY") && envPresent("PADDLE_WEBHOOK_SECRET");
};

export const isOcrConfigPresent = (): boolean => envPresent("GEMINI_API_KEY");

export const pingDatabase = async (
  execute: () => Promise<unknown> = () => db.execute(sql`select 1`),
): Promise<boolean> => {
  try {
    await execute();
    return true;
  } catch {
    return false;
  }
};

export const getReadinessChecks = async (
  deps: TReadinessDeps = {},
): Promise<TReadinessChecks> => {
  const database = await (deps.pingDatabase ?? pingDatabase)();
  const payment = (deps.paymentConfigured ?? isPaymentConfigPresent)();
  const ocr = (deps.ocrConfigured ?? isOcrConfigPresent)();
  return { database, payment, ocr };
};
