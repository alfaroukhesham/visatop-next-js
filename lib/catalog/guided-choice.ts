export const STAY_BUCKETS = ["1_14", "15_30", "31_60", "transit", "5_year"] as const;
export type TStayBucket = (typeof STAY_BUCKETS)[number];

export const ENTRY_KINDS = ["single", "multiple", "either"] as const;
export type TEntryKind = (typeof ENTRY_KINDS)[number];

export const TRAVELER_KINDS = ["adult", "child"] as const;
export type TTravelerKind = (typeof TRAVELER_KINDS)[number];
