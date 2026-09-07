-- Migration 0024: visa_service guided-choice fields (admin-entered chooser metadata)
-- Apply behavior if unset (documented in comments only, not enforced in code):
--   stay_bucket      null  -> hidden from guided chooser
--   entry_kind       'either' -> matches both Single and Multiple
--   traveler_kind    'adult'  -> only in Adult shortlist
--   show_in_guided_chooser true -> hidden from chooser when false

ALTER TABLE "visa_service"
  ADD COLUMN "stay_bucket" text,
  ADD COLUMN "entry_kind" text NOT NULL DEFAULT 'either',
  ADD COLUMN "traveler_kind" text NOT NULL DEFAULT 'adult',
  ADD COLUMN "show_in_guided_chooser" boolean NOT NULL DEFAULT true;--> statement-breakpoint

ALTER TABLE "visa_service"
  ADD CONSTRAINT "visa_service_stay_bucket_check"
    CHECK ("stay_bucket" IS NULL OR "stay_bucket" IN ('1_14', '15_30', '31_60', 'transit', '5_year'));--> statement-breakpoint

ALTER TABLE "visa_service"
  ADD CONSTRAINT "visa_service_entry_kind_check"
    CHECK ("entry_kind" IN ('single', 'multiple', 'either'));--> statement-breakpoint

ALTER TABLE "visa_service"
  ADD CONSTRAINT "visa_service_traveler_kind_check"
    CHECK ("traveler_kind" IN ('adult', 'child'));--> statement-breakpoint

-- One-time backfill (duration/entries already admin-entered — not a runtime classifier)
UPDATE visa_service SET stay_bucket = CASE
  WHEN duration_days IS NULL THEN NULL
  WHEN duration_days <= 14 THEN '1_14'
  WHEN duration_days <= 30 THEN '15_30'
  WHEN duration_days <= 60 THEN '31_60'
  WHEN duration_days >= 1825 THEN '5_year'
  ELSE NULL
END
WHERE stay_bucket IS NULL;--> statement-breakpoint

UPDATE visa_service SET entry_kind = CASE
  WHEN lower(coalesce(entries, '')) LIKE '%multi%' THEN 'multiple'
  WHEN lower(coalesce(entries, '')) LIKE '%single%' THEN 'single'
  ELSE 'either'
END
WHERE entry_kind IS NULL OR entry_kind = 'either';--> statement-breakpoint
