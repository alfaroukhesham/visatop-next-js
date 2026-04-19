-- Allow signed-in owners to run Paddle checkout: UPDATE application at ready_for_payment,
-- INSERT price_quote / payment, UPDATE payment for provider checkout id.
-- Draft-only client UPDATE remains in 0004; this policy ORs for the payment window.

CREATE POLICY application_client_update_own_checkout ON application
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND user_id IS NOT NULL
    AND user_id = app_actor_id()
    AND application_status = 'ready_for_payment'
    AND payment_status IN ('unpaid', 'checkout_created')
  )
  WITH CHECK (
    app_actor_type() = 'client'
    AND user_id IS NOT NULL
    AND user_id = app_actor_id()
    AND application_status = 'ready_for_payment'
    AND payment_status IN ('unpaid', 'checkout_created')
  );

CREATE POLICY price_quote_client_insert_own ON price_quote
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM application a
      WHERE a.id = price_quote.application_id
        AND a.user_id IS NOT NULL
        AND a.user_id = app_actor_id()
        AND a.application_status = 'ready_for_payment'
        AND a.payment_status = 'unpaid'
    )
  );

CREATE POLICY payment_client_insert_own ON payment
  FOR INSERT
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM application a
      WHERE a.id = payment.application_id
        AND a.user_id IS NOT NULL
        AND a.user_id = app_actor_id()
        AND a.application_status = 'ready_for_payment'
        AND a.payment_status = 'unpaid'
    )
  );

CREATE POLICY payment_client_update_own ON payment
  FOR UPDATE
  USING (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM application a
      WHERE a.id = payment.application_id
        AND a.user_id IS NOT NULL
        AND a.user_id = app_actor_id()
    )
  )
  WITH CHECK (
    app_actor_type() = 'client'
    AND EXISTS (
      SELECT 1 FROM application a
      WHERE a.id = payment.application_id
        AND a.user_id IS NOT NULL
        AND a.user_id = app_actor_id()
    )
  );
