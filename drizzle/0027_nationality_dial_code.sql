-- Migration 0027: admin-entered phone dial code per nationality (digits only, no +)

ALTER TABLE "nationality" ADD COLUMN "dial_code" text;
