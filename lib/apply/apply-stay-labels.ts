import type { TStayBucket } from "@/lib/catalog/guided-choice";

export const APPLY_STAY_LABELS: Record<TStayBucket, string> = {
  "1_14": "1–14 days",
  "15_30": "15–30 days",
  "31_60": "31–60 days",
  transit: "Transit",
  "5_year": "5 years",
};
