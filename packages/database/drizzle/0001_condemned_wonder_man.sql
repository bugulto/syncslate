CREATE TYPE "public"."editing_policy" AS ENUM('candidate_only', 'collaborative', 'interviewer_only');--> statement-breakpoint
CREATE TYPE "public"."problem_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."problem_visibility" AS ENUM('seeded', 'private');--> statement-breakpoint
CREATE TYPE "public"."programming_language" AS ENUM('typescript', 'javascript', 'python');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('waiting', 'active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interviewer_id" uuid NOT NULL,
	"problem_id" uuid,
	"title" text NOT NULL,
	"status" "session_status" DEFAULT 'waiting' NOT NULL,
	"language" "programming_language" NOT NULL,
	"editing_policy" "editing_policy" DEFAULT 'candidate_only' NOT NULL,
	"duration_seconds" integer NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"timer_state" jsonb NOT NULL,
	"final_code" text,
	"final_whiteboard" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_sessions_title_not_blank_check" CHECK (length(btrim("interview_sessions"."title")) > 0),
	CONSTRAINT "interview_sessions_duration_seconds_check" CHECK ("interview_sessions"."duration_seconds" between 300 and 10800)
);
--> statement-breakpoint
CREATE TABLE "problem_starter_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"language" "programming_language" NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_starter_code_problem_id_language_unique" UNIQUE("problem_id","language"),
	CONSTRAINT "problem_starter_code_code_not_blank_check" CHECK (length("problem_starter_code"."code") > 0)
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"visibility" "problem_visibility" NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description_markdown" text NOT NULL,
	"difficulty" "problem_difficulty" NOT NULL,
	"tags" text[] NOT NULL,
	"constraints_markdown" text,
	"examples" jsonb NOT NULL,
	"interviewer_notes_markdown" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problems_visibility_owner_check" CHECK ((
        ("problems"."visibility" = 'seeded' and "problems"."owner_id" is null)
        or ("problems"."visibility" = 'private' and "problems"."owner_id" is not null)
      )),
	CONSTRAINT "problems_title_not_blank_check" CHECK (length(btrim("problems"."title")) > 0),
	CONSTRAINT "problems_slug_not_blank_check" CHECK (length(btrim("problems"."slug")) > 0)
);
--> statement-breakpoint
CREATE TABLE "session_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "session_invitations_token_hash_not_blank_check" CHECK (length(btrim("session_invitations"."token_hash")) > 0),
	CONSTRAINT "session_invitations_expires_after_creation_check" CHECK ("session_invitations"."expires_at" > "session_invitations"."created_at")
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_interviewer_id_profiles_id_fk" FOREIGN KEY ("interviewer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_starter_code" ADD CONSTRAINT "problem_starter_code_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_invitations" ADD CONSTRAINT "session_invitations_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_sessions_interviewer_id_created_at_idx" ON "interview_sessions" USING btree ("interviewer_id","created_at");--> statement-breakpoint
CREATE INDEX "problem_starter_code_problem_id_idx" ON "problem_starter_code" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "problems_owner_id_idx" ON "problems" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "problems_visibility_idx" ON "problems" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "problems_difficulty_idx" ON "problems" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "problems_tags_idx" ON "problems" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "problems_slug_idx" ON "problems" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_invitations_session_id_idx" ON "session_invitations" USING btree ("session_id");