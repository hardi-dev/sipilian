CREATE TABLE "request_idempotency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_idempotency_user_key_unique" UNIQUE("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "tryout_attempts" ALTER COLUMN "twk_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_attempts" ALTER COLUMN "tiu_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_attempts" ALTER COLUMN "tkp_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_attempts" ALTER COLUMN "total_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_attempts" ALTER COLUMN "passed_all" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "request_idempotency" ADD CONSTRAINT "request_idempotency_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_question_states" ADD CONSTRAINT "user_question_states_user_question_unique" UNIQUE("user_id","question_id");