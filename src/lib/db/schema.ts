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
} from "drizzle-orm/pg-core";

// NOTES
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),

    parentId: uuid("parent_id"), // nullable root

    title: text("title").notNull(),
    sortPosition: integer("sort_position").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Day-1 uniqueness rail: prevents duplicate sibling titles per user
    // (If you later add slug, swap this to (user_id, parent_id, slug))
    uniqueIndex("notes_uniq_user_parent_title").on(t.userId, t.parentId, t.title),

    // Useful for tree navigation & sibling ordering queries
    index("notes_idx_user_parent_sort").on(t.userId, t.parentId, t.sortPosition),

    index("notes_idx_user").on(t.userId),
  ],
);

// CLOSURE TABLE
export const noteClosure = pgTable(
  "note_closure",
  {
    userId: uuid("user_id").notNull(),
    ancestorId: uuid("ancestor_id").notNull(),
    descendantId: uuid("descendant_id").notNull(),
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
    noteId: uuid("note_id").notNull(),
    userId: uuid("user_id").notNull(),

    type: text("type").notNull(), // e.g. 'paragraph' | 'heading' | ...
    position: integer("position").notNull(), // ordering within note

    contentJson: jsonb("content_json").notNull().default({}),
    plainText: text("plain_text").notNull().default(""),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // primary query for rendering a note
    index("blocks_idx_note_position").on(t.noteId, t.position),

    index("blocks_idx_user").on(t.userId),

    // prevent two blocks from having same position in same note
    uniqueIndex("blocks_uniq_note_position").on(t.noteId, t.position),
  ],
);
