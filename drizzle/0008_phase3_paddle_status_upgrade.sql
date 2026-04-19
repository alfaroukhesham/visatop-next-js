-- drizzle/0008_phase3_paddle_status_upgrade.sql
ALTER TABLE application ADD COLUMN IF NOT EXISTS admin_attention_required boolean NOT NULL DEFAULT false;

UPDATE application SET application_status = 'needs_review' WHERE application_status IN ('submitted', 'in_review');
UPDATE application SET application_status = 'completed' WHERE application_status = 'approved';
UPDATE application SET application_status = 'cancelled' WHERE application_status = 'rejected';

UPDATE application SET payment_status = 'checkout_created' WHERE payment_status = 'pending';

UPDATE application SET fulfillment_status = 'manual_in_progress' WHERE fulfillment_status = 'in_progress';
UPDATE application SET fulfillment_status = 'not_started' WHERE fulfillment_status = 'failed';

-- Client SELECT on own payment rows (same GUC actor model as 0002; do not use Supabase-only roles like "authenticated".)
DROP POLICY IF EXISTS "client select own payment" ON payment;
DROP POLICY IF EXISTS payment_client_select_own ON payment;
CREATE POLICY payment_client_select_own ON payment
  FOR SELECT
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM application a
      WHERE a.id = payment.application_id
        AND a.user_id IS NOT NULL
        AND a.user_id = app_actor_id()
    )
  );

-- Remove wrongly named policy if a failed migrate left it; canonical client quote policy is price_quote_client_select_own (0002).
DROP POLICY IF EXISTS "client select own quote" ON price_quote;

-- payment_system_all / payment_event_system_all / payment_admin_select already exist from 0002; do not replace with TO system / TO authenticated.
