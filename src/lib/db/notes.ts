import "server-only";
import { db } from "./drizzle";
import { blocks, notes, noteClosure } from "./schema";
import { eq, sql, and, desc, lt, or, isNull, ne, gt, inArray, asc } from "drizzle-orm";
import { Err, Ok } from "@/lib/result";
import { Errors, isAppError } from "@/lib/errors";
import { parseCursor } from "@/lib/server/utils";
import { rankAfter, rankBefore, rankBetween, rankInitial } from "@/lib/lexorank";

type RankableRow = {
  id: string;
  rank: string;
};

const persistDenseRanks = async (
  rows: RankableRow[],
  updateRank: (rowId: string, newRank: string) => Promise<void>,
) => {
  let prev: string | null = null;
  for (const row of rows) {
    const newRank: string = prev ? rankAfter(prev) : rankInitial();
    if (newRank !== row.rank) {
      await updateRank(row.id, newRank);
    }
    prev = newRank;
  }
};

const withRankExhaustionRecovery = async <T>(
  compute: () => Promise<T> | T,
  recover: () => Promise<void>,
) => {
  try {
    return await compute();
  } catch (error) {
    if (!isAppError(error) || error.code !== "RANK_EXHAUSTED") {
      throw error;
    }
    await recover();
    return await compute();
  }
};

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
      const lastSibling = await tx
        .select({ rank: notes.rank })
        .from(notes)
        .where(
          and(
            eq(notes.userId, input.userId),
            input.parentId ? eq(notes.parentId, input.parentId) : isNull(notes.parentId),
          ),
        )
        .orderBy(desc(notes.rank), desc(notes.id))
        .limit(1);

      const rank = lastSibling[0] ? rankAfter(lastSibling[0].rank) : rankInitial();

      const insertedNote = await tx
        .insert(notes)
        .values({
          userId: input.userId,
          parentId: input.parentId ?? null,
          title: input.title,
          rank,
        })
        .returning({ id: notes.id, createdAt: notes.createdAt, rank: notes.rank });

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

    return Ok({ id: result.id, createdAt: result.createdAt, rank: result.rank });
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
      const rebuildRanksForParent = async (parentId: string | null) => {
        const where = parentId
          ? and(eq(notes.userId, input.userId), eq(notes.parentId, parentId))
          : and(eq(notes.userId, input.userId), isNull(notes.parentId));

        const siblings = await tx
          .select({ id: notes.id, rank: notes.rank })
          .from(notes)
          .where(where)
          .orderBy(asc(notes.rank), asc(notes.id));

        await persistDenseRanks(siblings, async (rowId, newRank) => {
          await tx
            .update(notes)
            .set({ rank: newRank, updatedAt: new Date() })
            .where(and(eq(notes.userId, input.userId), eq(notes.id, rowId)));
        });
      };

      // 1) fetch parentId
      const noteRows = await tx
        .select({ parentId: notes.parentId, rank: notes.rank })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      let note = noteRows[0];
      if (!note) {
        throw Errors.NOTE_NOT_FOUND(input.noteId);
      }

      const targetParentId = note.parentId ?? null;

      const children = await tx
        .select({ id: notes.id, rank: notes.rank })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.parentId, input.noteId)))
        .orderBy(asc(notes.rank), asc(notes.id));

      if (children.length > 0) {
        await withRankExhaustionRecovery(
          async () => {
            await tx.transaction(async (innerTx) => {
              const parentWhere = targetParentId
                ? eq(notes.parentId, targetParentId)
                : isNull(notes.parentId);

              const nextSibling = await innerTx
                .select({ rank: notes.rank })
                .from(notes)
                .where(and(eq(notes.userId, input.userId), parentWhere, gt(notes.rank, note.rank)))
                .orderBy(asc(notes.rank), asc(notes.id))
                .limit(1);

              const prevSibling = await innerTx
                .select({ rank: notes.rank })
                .from(notes)
                .where(and(eq(notes.userId, input.userId), parentWhere, lt(notes.rank, note.rank)))
                .orderBy(desc(notes.rank), desc(notes.id))
                .limit(1);

              const tempRank = prevSibling[0]
                ? rankBetween(prevSibling[0].rank, note.rank)
                : rankBefore(note.rank);

              await innerTx
                .update(notes)
                .set({ rank: tempRank })
                .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

              let prevRank = note.rank;
              const upperRank = nextSibling[0]?.rank ?? null;

              for (let index = 0; index < children.length; index += 1) {
                const child = children[index];
                const newRank =
                  index === 0
                    ? note.rank
                    : upperRank
                      ? rankBetween(prevRank, upperRank)
                      : rankAfter(prevRank);
                prevRank = newRank;

                await innerTx
                  .update(notes)
                  .set({ parentId: targetParentId, rank: newRank })
                  .where(and(eq(notes.userId, input.userId), eq(notes.id, child.id)));
              }
            });
          },
          async () => {
            await rebuildRanksForParent(targetParentId);
            const refreshedNote = await tx
              .select({ parentId: notes.parentId, rank: notes.rank })
              .from(notes)
              .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

            note = refreshedNote[0];
            if (!note) {
              throw Errors.NOTE_NOT_FOUND(input.noteId);
            }
          },
        );
      }

      // 3) update closure depths for lifted subtrees
      if (note.parentId) {
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
  beforeId?: string | null;
  afterId?: string | null;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      const rebuildRanksForParent = async (parentId: string | null) => {
        const where = parentId
          ? and(eq(notes.userId, input.userId), eq(notes.parentId, parentId))
          : and(eq(notes.userId, input.userId), isNull(notes.parentId));

        const siblings = await tx
          .select({ id: notes.id, rank: notes.rank })
          .from(notes)
          .where(where)
          .orderBy(asc(notes.rank), asc(notes.id));

        await persistDenseRanks(siblings, async (rowId, newRank) => {
          await tx
            .update(notes)
            .set({ rank: newRank, updatedAt: new Date() })
            .where(and(eq(notes.userId, input.userId), eq(notes.id, rowId)));
        });
      };

      const existingNote = await tx
        .select({ parentId: notes.parentId, rank: notes.rank })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      let current = existingNote[0];
      if (!current) {
        throw Errors.NOTE_NOT_FOUND(input.noteId);
      }

      const targetParentId = input.newParentId ?? null;
      const beforeId = input.beforeId ?? null;
      const afterId = input.afterId ?? null;

      if (beforeId && afterId && beforeId === afterId) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "beforeId and afterId cannot be the same",
            path: ["beforeId", "afterId"],
          },
        ]);
      }

      if (targetParentId) {
        const parentExists = await tx
          .select({ id: notes.id })
          .from(notes)
          .where(and(eq(notes.userId, input.userId), eq(notes.id, targetParentId)));

        if (!parentExists[0]) {
          throw Errors.NOTE_NOT_FOUND(targetParentId);
        }

        const cycleCheck = await tx
          .select({ ancestorId: noteClosure.ancestorId })
          .from(noteClosure)
          .where(
            and(
              eq(noteClosure.userId, input.userId),
              eq(noteClosure.ancestorId, input.noteId),
              eq(noteClosure.descendantId, targetParentId),
            ),
          );

        if (cycleCheck[0]) {
          throw Errors.FORBIDDEN();
        }
      }

      const targetParentClause = targetParentId
        ? eq(notes.parentId, targetParentId)
        : isNull(notes.parentId);

      const anchorIds = [beforeId, afterId].filter(Boolean) as string[];
      const anchors = anchorIds.length
        ? await tx
            .select({ id: notes.id, parentId: notes.parentId, rank: notes.rank })
            .from(notes)
            .where(and(eq(notes.userId, input.userId), inArray(notes.id, anchorIds)))
        : [];

      const findAnchor = (id: string | null) => anchors.find((row) => row.id === id);

      const before = beforeId ? findAnchor(beforeId) : undefined;
      const after = afterId ? findAnchor(afterId) : undefined;

      if (targetParentId === current.parentId && !before && !after) {
        return { moved: false };
      }

      if (beforeId && !before) throw Errors.NOTE_NOT_FOUND(beforeId);
      if (afterId && !after) throw Errors.NOTE_NOT_FOUND(afterId);

      if (before && before.parentId !== targetParentId) {
        throw Errors.VALIDATION_ERROR([
          { code: "custom", message: "beforeId parent mismatch", path: ["beforeId"] },
        ]);
      }

      if (after && after.parentId !== targetParentId) {
        throw Errors.VALIDATION_ERROR([
          { code: "custom", message: "afterId parent mismatch", path: ["afterId"] },
        ]);
      }

      const prevSibling = async (anchorRank: string, anchorId: string | null) => {
        const rows = await tx
          .select({ id: notes.id, rank: notes.rank })
          .from(notes)
          .where(
            and(
              eq(notes.userId, input.userId),
              targetParentClause,
              ne(notes.id, input.noteId),
              or(
                lt(notes.rank, anchorRank),
                and(eq(notes.rank, anchorRank), anchorId ? lt(notes.id, anchorId) : sql`false`),
              ),
            ),
          )
          .orderBy(desc(notes.rank), desc(notes.id))
          .limit(1);

        return rows[0];
      };

      const nextSibling = async (anchorRank: string, anchorId: string | null) => {
        const rows = await tx
          .select({ id: notes.id, rank: notes.rank })
          .from(notes)
          .where(
            and(
              eq(notes.userId, input.userId),
              targetParentClause,
              ne(notes.id, input.noteId),
              or(
                gt(notes.rank, anchorRank),
                and(eq(notes.rank, anchorRank), anchorId ? gt(notes.id, anchorId) : sql`false`),
              ),
            ),
          )
          .orderBy(notes.rank, notes.id)
          .limit(1);

        return rows[0];
      };

      let lowerRank: string | null = null;
      let upperRank: string | null = null;

      if (before) {
        upperRank = before.rank;
        const prev = await prevSibling(before.rank, before.id);
        lowerRank = prev?.rank ?? null;
      }

      if (after) {
        lowerRank = after.rank;
        if (!upperRank) {
          const next = await nextSibling(after.rank, after.id);
          upperRank = next?.rank ?? null;
        }
      }

      if (!before && !after) {
        const last = await tx
          .select({ rank: notes.rank })
          .from(notes)
          .where(
            and(eq(notes.userId, input.userId), targetParentClause, ne(notes.id, input.noteId)),
          )
          .orderBy(desc(notes.rank), desc(notes.id))
          .limit(1);
        lowerRank = last[0]?.rank ?? null;
      }

      if (lowerRank && upperRank && lowerRank >= upperRank) {
        throw Errors.VALIDATION_ERROR([
          { code: "custom", message: "Invalid anchor ordering", path: ["beforeId", "afterId"] },
        ]);
      }

      const newRank = await withRankExhaustionRecovery(
        () => rankBetween(lowerRank, upperRank),
        async () => {
          await rebuildRanksForParent(targetParentId);

          const refreshedCurrent = await tx
            .select({ parentId: notes.parentId, rank: notes.rank })
            .from(notes)
            .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));
          const nextCurrent = refreshedCurrent[0];
          if (!nextCurrent) {
            throw Errors.NOTE_NOT_FOUND(input.noteId);
          }

          const refreshedAnchors = anchorIds.length
            ? await tx
                .select({ id: notes.id, parentId: notes.parentId, rank: notes.rank })
                .from(notes)
                .where(and(eq(notes.userId, input.userId), inArray(notes.id, anchorIds)))
            : [];

          const nextBefore = beforeId
            ? refreshedAnchors.find((row) => row.id === beforeId)
            : undefined;
          const nextAfter = afterId
            ? refreshedAnchors.find((row) => row.id === afterId)
            : undefined;

          if (beforeId && !nextBefore) throw Errors.NOTE_NOT_FOUND(beforeId);
          if (afterId && !nextAfter) throw Errors.NOTE_NOT_FOUND(afterId);

          if (nextBefore && nextBefore.parentId !== targetParentId) {
            throw Errors.VALIDATION_ERROR([
              { code: "custom", message: "beforeId parent mismatch", path: ["beforeId"] },
            ]);
          }

          if (nextAfter && nextAfter.parentId !== targetParentId) {
            throw Errors.VALIDATION_ERROR([
              { code: "custom", message: "afterId parent mismatch", path: ["afterId"] },
            ]);
          }

          let nextLowerRank: string | null = null;
          let nextUpperRank: string | null = null;

          if (nextBefore) {
            nextUpperRank = nextBefore.rank;
            const prev = await prevSibling(nextBefore.rank, nextBefore.id);
            nextLowerRank = nextAfter?.rank ?? prev?.rank ?? null;
          }

          if (nextAfter) {
            nextLowerRank = nextAfter.rank;
            if (!nextBefore) {
              const next = await nextSibling(nextAfter.rank, nextAfter.id);
              nextUpperRank = next?.rank ?? null;
            }
          }

          if (!nextBefore && !nextAfter) {
            const last = await tx
              .select({ rank: notes.rank })
              .from(notes)
              .where(
                and(eq(notes.userId, input.userId), targetParentClause, ne(notes.id, input.noteId)),
              )
              .orderBy(desc(notes.rank), desc(notes.id))
              .limit(1);
            nextLowerRank = last[0]?.rank ?? null;
          }

          if (nextLowerRank && nextUpperRank && nextLowerRank >= nextUpperRank) {
            throw Errors.VALIDATION_ERROR([
              {
                code: "custom",
                message: "Invalid anchor ordering",
                path: ["beforeId", "afterId"],
              },
            ]);
          }

          lowerRank = nextLowerRank;
          upperRank = nextUpperRank;
          current = nextCurrent;
        },
      );

      if (current.parentId === targetParentId && current.rank === newRank) {
        return { moved: false };
      }

      await tx
        .update(notes)
        .set({ parentId: targetParentId, rank: newRank, updatedAt: new Date() })
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      if (current.parentId !== targetParentId) {
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

        if (targetParentId) {
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
              AND a.descendant_id = ${targetParentId}
              AND d.ancestor_id = ${input.noteId}
          `);
        }
      }

      return { moved: true, rank: newRank };
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

export async function rebuildRanks(input: { userId?: string }) {
  try {
    await db.transaction(async (tx) => {
      const userWhere = input.userId ? eq(notes.userId, input.userId) : undefined;

      const parents = await tx
        .selectDistinct({ parentId: notes.parentId })
        .from(notes)
        .where(userWhere ?? sql`true`);

      const parentIdSet = new Set<string | null>(parents.map((p) => p.parentId));
      parentIdSet.add(null);

      const processParent = async (parentId: string | null) => {
        const where = parentId
          ? and(eq(notes.parentId, parentId), userWhere ?? sql`true`)
          : and(isNull(notes.parentId), userWhere ?? sql`true`);

        const rows = await tx
          .select({ id: notes.id, rank: notes.rank })
          .from(notes)
          .where(where)
          .orderBy(asc(notes.rank), asc(notes.id));

        let prev: string | null = null;
        for (const row of rows) {
          const newRank: string = prev ? rankAfter(prev) : rankInitial();
          if (newRank !== row.rank) {
            await tx.update(notes).set({ rank: newRank }).where(eq(notes.id, row.id));
          }
          prev = newRank;
        }
      };

      // ensure root is processed even if there are no nulls in the distinct list
      for (const parentId of parentIdSet) {
        await processParent(parentId);
      }
    });

    return Ok({ rebuilt: true });
  } catch {
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
          gt(notes.rank, parsedCursor.rank),
          and(eq(notes.rank, parsedCursor.rank), gt(notes.id, parsedCursor.id)),
        )
      : undefined;

    const rows = await db
      .select({
        id: notes.id,
        parentId: notes.parentId,
        title: notes.title,
        rank: notes.rank,
        createdAt: notes.createdAt,
        hasChildren: sql<boolean>`exists (
          select 1
          from ${noteClosure}
          where ${noteClosure.userId} = ${notes.userId}
            and ${noteClosure.ancestorId} = ${notes.id}
            and ${noteClosure.depth} = 1
        )`.mapWith(Boolean),
      })
      .from(notes)
      .where(
        and(eq(notes.userId, input.userId), parentClause, ...(cursorClause ? [cursorClause] : [])),
      )
      .orderBy(notes.rank, notes.id)
      .limit(input.limit + 1);

    const hasMore = rows.length > input.limit;
    const notesList = hasMore ? rows.slice(0, input.limit) : rows;
    const last = hasMore ? notesList[notesList.length - 1] : null;
    const nextCursor = last ? `${last.rank}|${last.id}` : null;

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
        rank: blocks.rank,
        contentJson: blocks.contentJson,
        plainText: blocks.plainText,
        createdAt: blocks.createdAt,
        updatedAt: blocks.updatedAt,
      })
      .from(blocks)
      .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, input.noteId)))
      .orderBy(blocks.rank, blocks.id);

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
