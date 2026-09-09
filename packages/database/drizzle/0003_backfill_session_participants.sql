INSERT INTO "session_participants" (
	"session_id",
	"user_id",
	"display_name",
	"role",
	"created_at"
)
SELECT
	"interview_sessions"."id",
	"interview_sessions"."interviewer_id",
	COALESCE(NULLIF(BTRIM("profiles"."display_name"), ''), 'Interviewer'),
	'interviewer',
	"interview_sessions"."created_at"
FROM "interview_sessions"
INNER JOIN "profiles"
	ON "profiles"."id" = "interview_sessions"."interviewer_id"
ON CONFLICT ("session_id", "role") DO NOTHING;
