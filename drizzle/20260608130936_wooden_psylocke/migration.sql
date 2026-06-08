ALTER TABLE "blocks" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "note_closure" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;