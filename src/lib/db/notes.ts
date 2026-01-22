import "server-only";
import { db } from "./drizzle";
import { notes, noteClosure } from "./schema";
import { eq, sql, and } from "drizzle-orm";

export async function createNote(input: {
  userId: string;
  parentId?: string | null;
  title: string;
}) {
  return db.transaction(async (tx) => {
    // 1) insert note
    const insertedNote = await tx
      .insert(notes)
      .values({
        userId: input.userId,
        parentId: input.parentId ?? null,
        title: input.title,
      })
      .returning();

    // 2) insert self closure row
    await tx.insert(noteClosure).values({
      userId: input.userId,
      ancestorId: insertedNote[0].id,
      descendantId: insertedNote[0].id,
      depth: 0,
    });

    // 3) insert ancestor rows from parent
    if (input.parentId) {
      await tx.insert(noteClosure).select(
        tx
          .select({
            userId: noteClosure.userId,
            ancestorId: noteClosure.ancestorId,
            descendantId: sql`${insertedNote[0].id}`.as("descendant_id"),
            depth: sql`${noteClosure.depth} + 1`.as("depth"),
          })
          .from(noteClosure)
          .where(
            and(eq(noteClosure.userId, input.userId), eq(noteClosure.descendantId, input.parentId)),
          ),
      );
    }

    // return created note
    return insertedNote[0];
  });
}

export async function deleteNote(input: { userId: string; noteId: string }) {
  return db.transaction(async (tx) => {
    // 1) fetch parentId
    // 2) reparent children
    // 3) insert new closure rows for lifted subtrees
    // 4) delete note (closure rows auto-delete via FK)
  });
}
export async function rebuildClosure(input: { userId?: string }) {
  return db.transaction(async (tx) => {
    // recursive CTE rebuild
  });
}
