import "server-only";
import { db } from "./drizzle";
import { blocks, notes, noteClosure } from "./schema";
import { eq, sql, and, desc, lt, or, isNull } from "drizzle-orm";
import { Err, Ok } from "@/lib/result";
import { Errors, isAppError } from "@/lib/errors";
import { parseCursor } from "@/lib/server/utils";

export async function createNote(input: {
  userId: string;
  parentId?: string | null;
  title: string;
}) {
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

export async function deleteNote(input: { userId: string; noteId: string }) {
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

export async function moveNote(input: {
  userId: string;
  noteId: string;
  newParentId: string | null;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      const existingNote = await tx
        .select({ parentId: notes.parentId })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      if (!existingNote[0]) {
        throw Errors.NOTE_NOT_FOUND(input.noteId);
      }

      if (existingNote[0].parentId === input.newParentId) {
        return { moved: false };
      }

      if (input.newParentId) {
        const parentExists = await tx
          .select({ id: notes.id })
          .from(notes)
          .where(and(eq(notes.userId, input.userId), eq(notes.id, input.newParentId)));

        if (!parentExists[0]) {
          throw Errors.NOTE_NOT_FOUND(input.newParentId);
        }

        const cycleCheck = await tx
          .select({ ancestorId: noteClosure.ancestorId })
          .from(noteClosure)
          .where(
            and(
              eq(noteClosure.userId, input.userId),
              eq(noteClosure.ancestorId, input.noteId),
              eq(noteClosure.descendantId, input.newParentId),
            ),
          );

        if (cycleCheck[0]) {
          throw Errors.FORBIDDEN();
        }
      }

      await tx
        .update(notes)
        .set({ parentId: input.newParentId })
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      await tx.execute(sql`
        DELETE FROM note_closure
        WHERE user_id = ${input.userId}
          AND descendant_id IN (
            SELECT descendant_id
            FROM note_closure
            WHERE user_id = ${input.userId}
              AND ancestor_id = ${input.noteId}
          )
          AND ancestor_id IN (
            SELECT ancestor_id
            FROM note_closure
            WHERE user_id = ${input.userId}
              AND descendant_id = ${input.noteId}
              AND ancestor_id <> ${input.noteId}
          )
      `);

      if (input.newParentId) {
        await tx.execute(sql`
          INSERT INTO note_closure (user_id, ancestor_id, descendant_id, depth)
          SELECT
            a.user_id,
            a.ancestor_id,
            d.descendant_id,
            a.depth + d.depth + 1
          FROM note_closure a
          CROSS JOIN note_closure d
          WHERE a.user_id = ${input.userId}
            AND d.user_id = ${input.userId}
            AND a.descendant_id = ${input.newParentId}
            AND d.ancestor_id = ${input.noteId}
        `);
      }

      return { moved: true };
    });

    return Ok(result);
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}

export async function rebuildClosure(input: { userId?: string }) {
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

export async function getNotesList(input: {
  userId: string;
  parentId?: string | null;
  limit: number;
  cursor?: string;
}) {
  try {
    const cursorResult = input.cursor ? parseCursor(input.cursor) : Ok(null);
    if (!cursorResult.ok) return Err(cursorResult.error);
    const parsedCursor = cursorResult.value;

    const parentClause = input.parentId
      ? eq(notes.parentId, input.parentId)
      : isNull(notes.parentId);
    const cursorClause = parsedCursor
      ? or(
          lt(notes.createdAt, parsedCursor.createdAt),
          and(eq(notes.createdAt, parsedCursor.createdAt), lt(notes.id, parsedCursor.id)),
        )
      : undefined;

    const rows = await db
      .select({
        id: notes.id,
        parentId: notes.parentId,
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(
        and(eq(notes.userId, input.userId), parentClause, ...(cursorClause ? [cursorClause] : [])),
      )
      .orderBy(desc(notes.createdAt), desc(notes.id))
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const notesList = hasMore ? rows.slice(0, input.limit) : rows;
    const last = hasMore ? notesList[notesList.length - 1] : null;
    const nextCursor = last ? `${last.createdAt.getTime()}|${last.id}` : null;

    return Ok({ notes: notesList, nextCursor });
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}

export async function getNoteById(input: { userId: string; noteId: string }) {
  try {
    const note = await db
      .select({
        id: notes.id,
        parentId: notes.parentId,
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

    if (!note[0]) {
      return Err(Errors.NOTE_NOT_FOUND(input.noteId));
    }

    const noteBlocks = await db
      .select({
        id: blocks.id,
        type: blocks.type,
        position: blocks.position,
        contentJson: blocks.contentJson,
        plainText: blocks.plainText,
        createdAt: blocks.createdAt,
        updatedAt: blocks.updatedAt,
      })
      .from(blocks)
      .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, input.noteId)))
      .orderBy(blocks.position, blocks.id);

    return Ok({ note: note[0], blocks: noteBlocks });
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}

export async function renameNote(input: { userId: string; noteId: string; title: string }) {
  try {
    const updated = await db
      .update(notes)
      .set({ title: input.title, updatedAt: new Date() })
      .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)))
      .returning({ id: notes.id, title: notes.title });

    if (!updated[0]) {
      return Err(Errors.NOTE_NOT_FOUND(input.noteId));
    }

    return Ok({ note: updated[0] });
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}
