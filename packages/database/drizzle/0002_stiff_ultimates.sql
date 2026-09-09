CREATE TYPE "public"."participant_role" AS ENUM('interviewer', 'candidate');--> statement-breakpoint
CREATE TABLE "session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"role" "participant_role" NOT NULL,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_participants_session_id_role_unique" UNIQUE("session_id","role"),
	CONSTRAINT "session_participants_role_user_check" CHECK ((
        ("session_participants"."role" = 'interviewer' and "session_participants"."user_id" is not null)
        or ("session_participants"."role" = 'candidate' and "session_participants"."user_id" is null)
      )),
	CONSTRAINT "session_participants_display_name_not_blank_check" CHECK (length(btrim("session_participants"."display_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_participants_session_id_idx" ON "session_participants" USING btree ("session_id");