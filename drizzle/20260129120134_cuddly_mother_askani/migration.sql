-- 1) add nullable column for backfill
ALTER TABLE "notes" ADD COLUMN "rank" text;--> statement-breakpoint

-- 2) backfill ranks per (user, parent) preserving current ordering (created_at desc, id desc)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, parent_id ORDER BY created_at DESC, id DESC) AS rn
  FROM "notes"
)
UPDATE "notes" n
SET rank = LPAD(rn::text, 16, '0')
FROM ranked r
WHERE n.id = r.id;--> statement-breakpoint

-- 3) enforce not-null and indexes after data is present
ALTER TABLE "notes" ALTER COLUMN "rank" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notes_uniq_user_parent_rank" ON "notes" ("user_id","parent_id","rank");--> statement-breakpoint
CREATE INDEX "notes_idx_user_parent_rank_id" ON "notes" ("user_id","parent_id","rank","id");
