CREATE TABLE "session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"actor_participant_id" uuid,
	"type" text NOT NULL,
	"schema_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_events_session_id_sequence_unique" UNIQUE("session_id","sequence"),
	CONSTRAINT "session_events_sequence_positive_check" CHECK ("session_events"."sequence" > 0),
	CONSTRAINT "session_events_schema_version_positive_check" CHECK ("session_events"."schema_version" > 0),
	CONSTRAINT "session_events_type_not_blank_check" CHECK (length(btrim("session_events"."type")) > 0)
);
--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_actor_participant_id_session_participants_id_fk" FOREIGN KEY ("actor_participant_id") REFERENCES "public"."session_participants"("id") ON DELETE set null ON UPDATE no action;