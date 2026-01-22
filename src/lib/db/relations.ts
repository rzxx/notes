import { defineRelations } from "drizzle-orm";
import { blocks, notes, noteClosure } from "./schema";

export const relations = defineRelations({ notes, noteClosure, blocks }, (r) => ({
  notes: {
    parent: r.one.notes({
      from: r.notes.parentId,
      to: r.notes.id,
      alias: "note_parent",
    }),
    children: r.many.notes({
      alias: "note_parent",
    }),

    blocks: r.many.blocks(),

    ancestorLinks: r.many.noteClosure({
      alias: "descendant_link",
    }),
    descendantLinks: r.many.noteClosure({
      alias: "ancestor_link",
    }),
  },

  blocks: {
    ancestor: r.one.notes({
      from: r.noteClosure.ancestorId,
      to: r.notes.id,
      alias: "ancestor_link",
    }),
    descendant: r.one.notes({
      from: r.noteClosure.descendantId,
      to: r.notes.id,
      alias: "descendant_link",
    }),
  },

  noteClosure: {
    ancestor: r.one.notes({
      from: r.noteClosure.ancestorId,
      to: r.notes.id,
      alias: "ancestor_link",
    }),
    descendant: r.one.notes({
      from: r.noteClosure.descendantId,
      to: r.notes.id,
      alias: "descendant_link",
    }),
  },
}));
