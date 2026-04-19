DROP INDEX IF EXISTS "payment_event_payloadHash_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "payment_event_payload_hash_unique" ON "payment_event" USING btree ("payload_hash");
