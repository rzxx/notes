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
    // 0) catch if tries to create note inside other user's note
    if (input.parentId) {
      const parentExists = await tx
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.parentId)));

      if (!parentExists[0]) {
        throw new Error("Parent note not found for user");
      }
    }

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
    const parentId = await tx
      .select({ parentId: notes.parentId })
      .from(notes)
      .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

    if (!parentId[0]) {
      return null;
    }

    // 2) reparent children
    await tx
      .update(notes)
      .set({
        parentId: parentId[0].parentId,
      })
      .where(and(eq(notes.userId, input.userId), eq(notes.parentId, input.noteId)));

    // 3) update closure depths for lifted subtrees
    if (parentId[0].parentId) {
      const ancestorIds = tx
        .select({ ancestorId: noteClosure.ancestorId })
        .from(noteClosure)
        .where(
          and(eq(noteClosure.userId, input.userId), eq(noteClosure.descendantId, input.noteId)),
        );

      const descendantIds = tx
        .select({ descendantId: noteClosure.descendantId })
        .from(noteClosure)
        .where(and(eq(noteClosure.userId, input.userId), eq(noteClosure.ancestorId, input.noteId)));

      await tx
        .update(noteClosure)
        .set({ depth: sql`${noteClosure.depth} - 1` })
        .where(
          and(
            eq(noteClosure.userId, input.userId),
            sql`${noteClosure.ancestorId} in (${ancestorIds})`,
            sql`${noteClosure.descendantId} in (${descendantIds})`,
            sql`${noteClosure.ancestorId} <> ${input.noteId}`,
            sql`${noteClosure.descendantId} <> ${input.noteId}`,
          ),
        );
    }
    // 4) delete note (closure rows auto-delete via FK)
    const deletedNote = await tx
      .delete(notes)
      .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)))
      .returning();

    return deletedNote[0] ?? null;
  });
}
export async function rebuildClosure(input: { userId?: string }) {
  return db.transaction(async (tx) => {
    // recursive CTE rebuild
  });
}
