CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"note_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"position" integer NOT NULL,
	"content_json" jsonb DEFAULT '{}' NOT NULL,
	"plain_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_closure" (
	"user_id" uuid,
	"ancestor_id" uuid,
	"descendant_id" uuid,
	"depth" integer NOT NULL,
	CONSTRAINT "note_closure_pk" PRIMARY KEY("user_id","ancestor_id","descendant_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "blocks_idx_note_position" ON "blocks" ("note_id","position");--> statement-breakpoint
CREATE INDEX "blocks_idx_user" ON "blocks" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_uniq_note_position" ON "blocks" ("note_id","position");--> statement-breakpoint
CREATE INDEX "note_closure_idx_user_ancestor" ON "note_closure" ("user_id","ancestor_id");--> statement-breakpoint
CREATE INDEX "note_closure_idx_user_descendant" ON "note_closure" ("user_id","descendant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_uniq_user_parent_title" ON "notes" ("user_id","parent_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_uniq_user_root_title" ON "notes" ("user_id","title") WHERE "parent_id" is null;--> statement-breakpoint
CREATE INDEX "notes_idx_user" ON "notes" ("user_id");--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_note_id_notes_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_closure" ADD CONSTRAINT "note_closure_ancestor_id_notes_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "notes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "note_closure" ADD CONSTRAINT "note_closure_descendant_id_notes_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "notes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_parent_id_notes_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "notes"("id") ON DELETE SET NULL;