import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// NOTES
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),

    parentId: uuid("parent_id").references((): AnyPgColumn => notes.id, { onDelete: "set null" }), // nullable root

    title: text("title").notNull(),

    rank: text("rank").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Day-1 uniqueness rail: prevents duplicate sibling titles per user
    uniqueIndex("notes_uniq_user_parent_title").on(t.userId, t.parentId, t.title),
    uniqueIndex("notes_uniq_user_root_title")
      .on(t.userId, t.title)
      .where(sql`${t.parentId} is null`),

    uniqueIndex("notes_uniq_user_parent_rank").on(t.userId, t.parentId, t.rank),

    index("notes_idx_user").on(t.userId),
    index("notes_idx_user_parent_created_id").on(t.userId, t.parentId, t.createdAt, t.id),
    index("notes_idx_user_parent_rank_id").on(t.userId, t.parentId, t.rank, t.id),
  ],
);

// CLOSURE TABLE
export const noteClosure = pgTable(
  "note_closure",
  {
    userId: uuid("user_id").notNull(),
    ancestorId: uuid("ancestor_id")
      .notNull()
      .references((): AnyPgColumn => notes.id, { onDelete: "cascade" }),
    descendantId: uuid("descendant_id")
      .notNull()
      .references((): AnyPgColumn => notes.id, { onDelete: "cascade" }),
    depth: integer("depth").notNull(), // 0 = self row
  },
  (t) => [
    primaryKey({
      name: "note_closure_pk",
      columns: [t.userId, t.ancestorId, t.descendantId],
    }),
    index("note_closure_idx_user_ancestor").on(t.userId, t.ancestorId),
    index("note_closure_idx_user_descendant").on(t.userId, t.descendantId),
  ],
);

// BLOCKS (flat list per note)
export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noteId: uuid("note_id")
      .notNull()
      .references((): AnyPgColumn => notes.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),

    type: text("type").notNull(), // e.g. 'paragraph' | 'heading' | ...
    rank: text("rank").notNull(), // ordering within note

    contentJson: jsonb("content_json").notNull().default({}),
    plainText: text("plain_text").notNull().default(""),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // primary query for rendering a note
    index("blocks_idx_note_rank_id").on(t.noteId, t.rank, t.id),

    index("blocks_idx_user").on(t.userId),

    // prevent two blocks from having same rank in same note
    uniqueIndex("blocks_uniq_note_rank").on(t.noteId, t.rank),
  ],
);
