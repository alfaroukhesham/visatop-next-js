-- drizzle/0008_phase3_paddle_status_upgrade.sql
ALTER TABLE application ADD COLUMN admin_attention_required boolean NOT NULL DEFAULT false;

UPDATE application SET application_status = 'needs_review' WHERE application_status IN ('submitted', 'in_review');
UPDATE application SET application_status = 'completed' WHERE application_status = 'approved';
UPDATE application SET application_status = 'cancelled' WHERE application_status = 'rejected';

UPDATE application SET payment_status = 'checkout_created' WHERE payment_status = 'pending';

UPDATE application SET fulfillment_status = 'manual_in_progress' WHERE fulfillment_status = 'in_progress';
UPDATE application SET fulfillment_status = 'not_started' WHERE fulfillment_status = 'failed';

-- Add client SELECT own row to payment
DROP POLICY IF EXISTS "client select own payment" ON payment;
CREATE POLICY "client select own payment" ON payment FOR SELECT TO authenticated
USING (application_id IN (SELECT id FROM application WHERE user_id = current_setting('app.actor_id', true)));

-- Add client SELECT own row to price_quote
DROP POLICY IF EXISTS "client select own quote" ON price_quote;
CREATE POLICY "client select own quote" ON price_quote FOR SELECT TO authenticated
USING (application_id IN (SELECT id FROM application WHERE user_id = current_setting('app.actor_id', true)));

-- System access for payments
DROP POLICY IF EXISTS "system all payment" ON payment;
CREATE POLICY "system all payment" ON payment FOR ALL TO system USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "system all payment_event" ON payment_event;
CREATE POLICY "system all payment_event" ON payment_event FOR ALL TO system USING (true) WITH CHECK (true);

-- Admin select for payments
DROP POLICY IF EXISTS "admin select payment" ON payment;
CREATE POLICY "admin select payment" ON payment FOR SELECT TO authenticated
USING (current_setting('app.actor_type', true) = 'admin' AND current_setting('app.rbac_applications_read', true) = 'true');

DROP POLICY IF EXISTS "admin select payment_event" ON payment_event;
CREATE POLICY "admin select payment_event" ON payment_event FOR SELECT TO authenticated
USING (current_setting('app.actor_type', true) = 'admin' AND current_setting('app.rbac_applications_read', true) = 'true');
