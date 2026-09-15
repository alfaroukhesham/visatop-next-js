CREATE TABLE "analytics_funnel_event" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"event_name" text NOT NULL,
	"session_id" text NOT NULL,
	"application_id" text,
	"nationality_code" text,
	"service_id" text,
	"source" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_funnel_event" ADD CONSTRAINT "analytics_funnel_event_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_funnel_event_eventId_uidx" ON "analytics_funnel_event" ("event_id");--> statement-breakpoint
CREATE INDEX "analytics_funnel_event_occurredAt_idx" ON "analytics_funnel_event" ("occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_funnel_event_eventName_idx" ON "analytics_funnel_event" ("event_name");--> statement-breakpoint
CREATE INDEX "analytics_funnel_event_applicationId_idx" ON "analytics_funnel_event" ("application_id");--> statement-breakpoint
CREATE INDEX "analytics_funnel_event_sessionId_idx" ON "analytics_funnel_event" ("session_id");--> statement-breakpoint
ALTER TABLE "analytics_funnel_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "analytics_funnel_event_system_all" ON "analytics_funnel_event"
  USING (app_actor_type() = 'system')
  WITH CHECK (app_actor_type() = 'system');--> statement-breakpoint
CREATE POLICY "analytics_funnel_event_admin_select" ON "analytics_funnel_event"
  FOR SELECT
  USING (app_actor_type() = 'admin');--> statement-breakpoint
CREATE POLICY "analytics_funnel_event_client_insert" ON "analytics_funnel_event"
  FOR INSERT
  WITH CHECK (app_actor_type() = 'client');
