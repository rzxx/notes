ALTER TABLE "blocks" RENAME COLUMN "position" TO "rank";--> statement-breakpoint
ALTER INDEX "blocks_uniq_note_position" RENAME TO "blocks_uniq_note_rank";--> statement-breakpoint
DROP INDEX "blocks_idx_note_position";--> statement-breakpoint
ALTER TABLE "blocks" ALTER COLUMN "rank" SET DATA TYPE text USING LPAD("rank"::text, 16, '0');--> statement-breakpoint
CREATE INDEX "blocks_idx_note_rank_id" ON "blocks" ("note_id","rank","id");
