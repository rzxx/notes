import "server-only";
import { db } from "./drizzle";
import { notes, noteClosure } from "./schema";
import { eq, sql, and } from "drizzle-orm";
import { Err, Ok, type Result } from "@/lib/result";
import { Errors, isAppError, type AppError } from "@/lib/server/errors";

export async function createNote(input: {
  userId: string;
  parentId?: string | null;
  title: string;
}): Promise<Result<{ id: string }, AppError>> {
  try {
    const result = await db.transaction(async (tx) => {
      // 0) catch if tries to create note inside other user's note
      if (input.parentId) {
        const parentExists = await tx
          .select({ id: notes.id })
          .from(notes)
          .where(and(eq(notes.userId, input.userId), eq(notes.id, input.parentId)));

        if (!parentExists[0]) {
          throw Errors.NOTE_NOT_FOUND(input.parentId);
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
        .returning({ id: notes.id });

      // sanity check
      if (!insertedNote[0]) throw Errors.DB_ERROR();

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
              and(
                eq(noteClosure.userId, input.userId),
                eq(noteClosure.descendantId, input.parentId),
              ),
            ),
        );
      }

      // return created note
      return insertedNote[0];
    });

    return Ok({ id: result.id });
  } catch (e) {
    // If we threw our own AppError, preserve it
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    // Otherwise treat as internal/db failure (log e if you want)
    return Err(Errors.DB_ERROR());
  }
}

export async function deleteNote(input: {
  userId: string;
  noteId: string;
}): Promise<Result<{ deleted: true }, AppError>> {
  try {
    await db.transaction(async (tx) => {
      // 1) fetch parentId
      const parentId = await tx
        .select({ parentId: notes.parentId })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      if (!parentId[0]) {
        throw Errors.NOTE_NOT_FOUND(input.noteId);
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
          .where(
            and(eq(noteClosure.userId, input.userId), eq(noteClosure.ancestorId, input.noteId)),
          );

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
      await tx.delete(notes).where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));
    });

    return Ok({ deleted: true });
  } catch (e) {
    // If we threw our own AppError, preserve it
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    // Otherwise treat as internal/db failure (log e if you want)
    return Err(Errors.DB_ERROR());
  }
}
export async function rebuildClosure(input: {
  userId?: string;
}): Promise<Result<{ rebuilt: true }, AppError>> {
  try {
    await db.transaction(async (tx) => {
      if (input.userId) {
        await tx.delete(noteClosure).where(eq(noteClosure.userId, input.userId));
      } else {
        await tx.delete(noteClosure);
      }

      const userWhere = input.userId ? sql`where n.user_id = ${input.userId}` : sql``;

      await tx.execute(sql`
      with recursive closure as (
        select
          n.user_id as user_id,
          n.id as ancestor_id,
          n.id as descendant_id,
          0 as depth
        from notes n
        ${userWhere}

        union all

        select
          c.user_id as user_id,
          p.parent_id as ancestor_id,
          c.descendant_id as descendant_id,
          c.depth + 1 as depth
        from closure c
        join notes p
          on p.id = c.ancestor_id
         and p.user_id = c.user_id
        where p.parent_id is not null
      )
      insert into note_closure (user_id, ancestor_id, descendant_id, depth)
      select user_id, ancestor_id, descendant_id, depth
      from closure
    `);
    });

    return Ok({ rebuilt: true });
  } catch {
    // treat as internal/db failure (log e if you want)
    return Err(Errors.DB_ERROR());
  }
}
