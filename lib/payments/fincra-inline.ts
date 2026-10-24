import type { FincraFeeBearer } from "@/lib/payments/resolve-payment-provider";
import { fincraMinorToMajorNumber } from "@/lib/payments/fincra-amounts";

export const FINCRA_INLINE_SCRIPT_SRC =
  "https://unpkg.com/@fincra-engineering/checkout@2.2.0/dist/inline.min.js";

export type TFincraInlineCustomer = {
  name: string;
  email: string;
  phoneNumber?: string;
};

export const FINCRA_INLINE_PAYMENT_METHODS = ["card", "bank_transfer"] as const;

export type TFincraInlineCheckoutData = {
  provider: "fincra";
  mode: "inline";
  key: string;
  amount: number;
  currency: "NGN";
  customer: TFincraInlineCustomer;
  reference: string;
  feeBearer: FincraFeeBearer;
  metadata: Record<string, string>;
};

export type TFincraHostedCheckoutData = {
  provider: "fincra";
  mode: "hosted";
  redirectUrl: string;
};

export type TFincraInitializeOptions = {
  key: string;
  amount: number;
  currency: "NGN";
  customer: TFincraInlineCustomer;
  reference: string;
  feeBearer: FincraFeeBearer;
  metadata: Record<string, string>;
  paymentMethods: string[];
  onSuccess: (data: { reference?: string }) => void;
  onClose: () => void;
};

export type TFincraInlineApi = {
  initialize: (options: TFincraInitializeOptions) => void;
};

type TWindowWithFincra = Window & { Fincra?: TFincraInlineApi };

export const buildFincraInlineCheckoutData = (params: {
  publicKey: string;
  amountMinor: bigint;
  customer: { name: string; email: string; phoneNumber?: string | null };
  reference: string;
  feeBearer: FincraFeeBearer;
  metadata: Record<string, string>;
}): TFincraInlineCheckoutData => {
  const phone = params.customer.phoneNumber?.trim();
  const customer: TFincraInlineCustomer = {
    name: params.customer.name,
    email: params.customer.email,
  };
  if (phone) customer.phoneNumber = phone;
  return {
    provider: "fincra",
    mode: "inline",
    key: params.publicKey,
    amount: fincraMinorToMajorNumber(params.amountMinor),
    currency: "NGN",
    customer,
    reference: params.reference,
    feeBearer: params.feeBearer,
    metadata: params.metadata,
  };
};

export const toFincraInitializeOptions = (
  data: TFincraInlineCheckoutData,
  hooks: { onSuccess: TFincraInitializeOptions["onSuccess"]; onClose: TFincraInitializeOptions["onClose"] },
): TFincraInitializeOptions => ({
  key: data.key,
  amount: data.amount,
  currency: data.currency,
  customer: data.customer,
  reference: data.reference,
  feeBearer: data.feeBearer,
  metadata: data.metadata,
  paymentMethods: [...FINCRA_INLINE_PAYMENT_METHODS],
  onSuccess: hooks.onSuccess,
  onClose: hooks.onClose,
});

let widgetOpen = false;
const openedInlineReferences = new Set<string>();

export const isFincraInlineWidgetOpen = (): boolean => widgetOpen;

export const claimFincraInlineReference = (reference: string): boolean => {
  if (openedInlineReferences.has(reference)) return false;
  openedInlineReferences.add(reference);
  return true;
};

export const hasFincraInlineReferenceBeenOpened = (reference: string): boolean =>
  openedInlineReferences.has(reference);

export const initializeFincraInlineCheckout = (
  api: TFincraInlineApi,
  data: TFincraInlineCheckoutData,
  hooks: { onSuccess: TFincraInitializeOptions["onSuccess"]; onClose: TFincraInitializeOptions["onClose"] },
): boolean => {
  if (widgetOpen) return false;
  widgetOpen = true;
  try {
    api.initialize(
      toFincraInitializeOptions(data, {
        onSuccess: (payload) => {
          widgetOpen = false;
          hooks.onSuccess(payload);
        },
        onClose: () => {
          widgetOpen = false;
          hooks.onClose();
        },
      }),
    );
    return true;
  } catch (err) {
    widgetOpen = false;
    throw err;
  }
};

export const getFincraInlineApi = (): TFincraInlineApi | null => {
  if (typeof window === "undefined") return null;
  const api = (window as TWindowWithFincra).Fincra;
  return api && typeof api.initialize === "function" ? api : null;
};

let inflightLoad: Promise<TFincraInlineApi> | null = null;

export const loadFincraInlineScript = (): Promise<TFincraInlineApi> => {
  const existing = getFincraInlineApi();
  if (existing) return Promise.resolve(existing);
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Fincra inline script requires a browser"));
  }
  if (inflightLoad) return inflightLoad;

  inflightLoad = new Promise<TFincraInlineApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = FINCRA_INLINE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const api = getFincraInlineApi();
      if (!api) {
        inflightLoad = null;
        reject(new Error("Fincra inline script loaded but Fincra is unavailable"));
        return;
      }
      resolve(api);
    };
    script.onerror = () => {
      inflightLoad = null;
      reject(new Error("Fincra inline script failed to load"));
    };
    document.head.appendChild(script);
  });

  return inflightLoad;
};

export const resetFincraInlineScriptLoaderForTests = (): void => {
  inflightLoad = null;
};

export const resetFincraInlineWidgetLockForTests = (): void => {
  widgetOpen = false;
  openedInlineReferences.clear();
};
