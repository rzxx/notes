import "server-only";
import { db } from "./drizzle";
import { blocks, notes } from "./schema";
import { and, asc, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { Err, Ok } from "@/lib/result";
import { Errors, isAppError } from "@/lib/errors";
import { buildTextBlockContent } from "@/lib/editor/block-content";
import { compareRanks, rankAfter, rankBetween, rankInitial } from "@/lib/lexorank";

type BlockRow = {
  id: string;
  noteId: string;
  type: string;
  rank: string;
  contentJson: unknown;
  plainText: string;
  createdAt: Date;
  updatedAt: Date;
};

const selectBlock = {
  id: blocks.id,
  noteId: blocks.noteId,
  type: blocks.type,
  rank: blocks.rank,
  contentJson: blocks.contentJson,
  plainText: blocks.plainText,
  createdAt: blocks.createdAt,
  updatedAt: blocks.updatedAt,
};

export async function createBlock(input: {
  userId: string;
  noteId: string;
  type: string;
  position: number;
  contentJson?: unknown;
  plainText?: string;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      const noteRows = await tx
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      if (!noteRows[0]) throw Errors.NOTE_NOT_FOUND(input.noteId);

      const computeRank = (ordered: { id: string; rank: string }[]) => {
        const clampedPosition = Math.max(0, Math.min(input.position, ordered.length));
        const lowerRank = clampedPosition > 0 ? (ordered[clampedPosition - 1]?.rank ?? null) : null;
        const upperRank =
          clampedPosition < ordered.length ? (ordered[clampedPosition]?.rank ?? null) : null;
        return rankBetween(lowerRank, upperRank);
      };

      const getOrdered = () =>
        tx
          .select({ id: blocks.id, rank: blocks.rank })
          .from(blocks)
          .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, input.noteId)))
          .orderBy(asc(blocks.rank), asc(blocks.id));

      const rebuildRanks = async () => {
        const rows = await getOrdered();
        let prev: string | null = null;

        for (const row of rows) {
          const newRank: string = prev ? rankAfter(prev) : rankInitial();
          if (newRank !== row.rank) {
            await tx
              .update(blocks)
              .set({ rank: newRank, updatedAt: new Date() })
              .where(eq(blocks.id, row.id));
          }
          prev = newRank;
        }
      };

      let ordered = await getOrdered();
      let rank: string;
      try {
        rank = computeRank(ordered);
      } catch (error) {
        if (!isAppError(error) || error.code !== "RANK_EXHAUSTED") throw error;
        await rebuildRanks();
        ordered = await getOrdered();
        rank = computeRank(ordered);
      }

      const inserted = await tx
        .insert(blocks)
        .values({
          userId: input.userId,
          noteId: input.noteId,
          type: input.type,
          rank,
          contentJson: input.contentJson ?? {},
          plainText: input.plainText ?? "",
        })
        .returning(selectBlock);

      if (!inserted[0]) throw Errors.DB_ERROR();
      return inserted[0] as BlockRow;
    });

    return Ok({ block: result });
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}

export async function updateBlock(input: {
  userId: string;
  blockId: string;
  type?: string;
  contentJson?: unknown;
  plainText?: string;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select(selectBlock)
        .from(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));

      if (!existing[0]) throw Errors.BLOCK_NOT_FOUND(input.blockId);

      const patch: Partial<BlockRow> = {};
      if (input.type !== undefined) patch.type = input.type;
      if (input.contentJson !== undefined) patch.contentJson = input.contentJson;
      if (input.plainText !== undefined) patch.plainText = input.plainText;

      if (Object.keys(patch).length === 0) {
        return existing[0] as BlockRow;
      }

      const updated = await tx
        .update(blocks)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)))
        .returning(selectBlock);

      if (!updated[0]) throw Errors.DB_ERROR();
      return updated[0] as BlockRow;
    });

    return Ok({ block: result });
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}

export async function splitBlock(input: {
  userId: string;
  blockId: string;
  beforeText: string;
  afterText: string;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select(selectBlock)
        .from(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));

      let block = existing[0];
      if (!block) throw Errors.BLOCK_NOT_FOUND(input.blockId);

      const beforeContent = buildTextBlockContent({
        type: block.type,
        text: input.beforeText,
      });
      if (!beforeContent.ok) throw beforeContent.error;

      const afterContent = buildTextBlockContent({
        type: block.type,
        text: input.afterText,
      });
      if (!afterContent.ok) throw afterContent.error;

      const findNextSibling = (currentRank: string) =>
        tx
          .select({ rank: blocks.rank })
          .from(blocks)
          .where(
            and(
              eq(blocks.userId, input.userId),
              eq(blocks.noteId, block.noteId),
              gt(blocks.rank, currentRank),
            ),
          )
          .orderBy(asc(blocks.rank), asc(blocks.id))
          .limit(1);

      const rebuildRanks = async () => {
        const rows = await tx
          .select({ id: blocks.id, rank: blocks.rank })
          .from(blocks)
          .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, block.noteId)))
          .orderBy(asc(blocks.rank), asc(blocks.id));

        let prev: string | null = null;
        for (const row of rows) {
          const newRank: string = prev ? rankAfter(prev) : rankInitial();
          if (newRank !== row.rank) {
            await tx
              .update(blocks)
              .set({ rank: newRank, updatedAt: new Date() })
              .where(eq(blocks.id, row.id));
          }
          prev = newRank;
        }
      };

      let nextSibling = await findNextSibling(block.rank);
      let newRank: string;
      try {
        newRank = rankBetween(block.rank, nextSibling[0]?.rank ?? null);
      } catch (error) {
        if (!isAppError(error) || error.code !== "RANK_EXHAUSTED") throw error;
        await rebuildRanks();
        const refreshed = await tx
          .select(selectBlock)
          .from(blocks)
          .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));
        if (!refreshed[0]) throw Errors.BLOCK_NOT_FOUND(input.blockId);
        block = refreshed[0] as BlockRow;
        nextSibling = await findNextSibling(block.rank);
        newRank = rankBetween(block.rank, nextSibling[0]?.rank ?? null);
      }

      const updated = await tx
        .update(blocks)
        .set({
          contentJson: beforeContent.value,
          plainText: input.beforeText,
          updatedAt: new Date(),
        })
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)))
        .returning(selectBlock);

      if (!updated[0]) throw Errors.DB_ERROR();

      const inserted = await tx
        .insert(blocks)
        .values({
          userId: input.userId,
          noteId: block.noteId,
          type: block.type,
          rank: newRank,
          contentJson: afterContent.value,
          plainText: input.afterText,
        })
        .returning(selectBlock);

      if (!inserted[0]) throw Errors.DB_ERROR();

      return { block: updated[0] as BlockRow, newBlock: inserted[0] as BlockRow };
    });

    return Ok(result);
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}

export async function mergeBlocks(input: {
  userId: string;
  prevBlockId: string;
  currentBlockId: string;
  mergedText: string;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select(selectBlock)
        .from(blocks)
        .where(
          and(
            eq(blocks.userId, input.userId),
            inArray(blocks.id, [input.prevBlockId, input.currentBlockId]),
          ),
        );

      const prev = existing.find((row) => row.id === input.prevBlockId);
      const current = existing.find((row) => row.id === input.currentBlockId);

      if (!prev) throw Errors.BLOCK_NOT_FOUND(input.prevBlockId);
      if (!current) throw Errors.BLOCK_NOT_FOUND(input.currentBlockId);
      if (prev.noteId !== current.noteId) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "Blocks must belong to the same note",
            path: ["currentBlockId"],
          },
        ]);
      }
      if (compareRanks(prev.rank, current.rank) >= 0) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "prevBlockId must be before currentBlockId",
            path: ["prevBlockId"],
          },
        ]);
      }

      const mergedContent = buildTextBlockContent({
        type: prev.type,
        text: input.mergedText,
      });
      if (!mergedContent.ok) throw mergedContent.error;

      const updated = await tx
        .update(blocks)
        .set({
          contentJson: mergedContent.value,
          plainText: input.mergedText,
          updatedAt: new Date(),
        })
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, prev.id)))
        .returning(selectBlock);

      if (!updated[0]) throw Errors.DB_ERROR();

      await tx
        .delete(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, current.id)));

      return { block: updated[0] as BlockRow };
    });

    return Ok(result);
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}

export async function deleteBlock(input: { userId: string; blockId: string }) {
  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: blocks.id })
        .from(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));

      if (!existing[0]) throw Errors.BLOCK_NOT_FOUND(input.blockId);

      await tx
        .delete(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));
    });

    return Ok({ deleted: true });
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}

export async function reorderBlocks(input: {
  userId: string;
  noteId: string;
  blockId: string;
  beforeId?: string | null;
  afterId?: string | null;
}) {
  try {
    const result = await db.transaction(async (tx) => {
      const noteRows = await tx
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      if (!noteRows[0]) throw Errors.NOTE_NOT_FOUND(input.noteId);

      const currentRows = await tx
        .select({ id: blocks.id, noteId: blocks.noteId, rank: blocks.rank })
        .from(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));

      let current = currentRows[0];
      if (!current) throw Errors.BLOCK_NOT_FOUND(input.blockId);
      if (current.noteId !== input.noteId) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "blockId must belong to noteId",
            path: ["blockId"],
          },
        ]);
      }

      const readAnchor = async (id: string) =>
        (
          await tx
            .select({ id: blocks.id, noteId: blocks.noteId, rank: blocks.rank })
            .from(blocks)
            .where(and(eq(blocks.userId, input.userId), eq(blocks.id, id)))
        )[0] ?? null;

      let before = input.beforeId ? await readAnchor(input.beforeId) : null;

      let after = input.afterId ? await readAnchor(input.afterId) : null;

      if (input.beforeId && !before) throw Errors.BLOCK_NOT_FOUND(input.beforeId);
      if (input.afterId && !after) throw Errors.BLOCK_NOT_FOUND(input.afterId);

      if (before && before.noteId !== input.noteId) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "beforeId must belong to noteId",
            path: ["beforeId"],
          },
        ]);
      }
      if (after && after.noteId !== input.noteId) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "afterId must belong to noteId",
            path: ["afterId"],
          },
        ]);
      }

      if (before && before.id === current.id) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "beforeId cannot be the same as blockId",
            path: ["beforeId"],
          },
        ]);
      }
      if (after && after.id === current.id) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "afterId cannot be the same as blockId",
            path: ["afterId"],
          },
        ]);
      }

      if (before && after && compareRanks(after.rank, before.rank) >= 0) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "afterId must be before beforeId",
            path: ["afterId", "beforeId"],
          },
        ]);
      }

      const prevSibling = async (anchorRank: string, anchorId: string) => {
        const rows = await tx
          .select({ id: blocks.id, rank: blocks.rank })
          .from(blocks)
          .where(
            and(
              eq(blocks.userId, input.userId),
              eq(blocks.noteId, input.noteId),
              ne(blocks.id, current.id),
              or(
                lt(blocks.rank, anchorRank),
                and(eq(blocks.rank, anchorRank), lt(blocks.id, anchorId)),
              ),
            ),
          )
          .orderBy(desc(blocks.rank), desc(blocks.id))
          .limit(1);
        return rows[0] ?? null;
      };

      const nextSibling = async (anchorRank: string, anchorId: string) => {
        const rows = await tx
          .select({ id: blocks.id, rank: blocks.rank })
          .from(blocks)
          .where(
            and(
              eq(blocks.userId, input.userId),
              eq(blocks.noteId, input.noteId),
              ne(blocks.id, current.id),
              or(
                gt(blocks.rank, anchorRank),
                and(eq(blocks.rank, anchorRank), gt(blocks.id, anchorId)),
              ),
            ),
          )
          .orderBy(asc(blocks.rank), asc(blocks.id))
          .limit(1);
        return rows[0] ?? null;
      };

      const rebuildRanks = async () => {
        const rows = await tx
          .select({ id: blocks.id, rank: blocks.rank })
          .from(blocks)
          .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, input.noteId)))
          .orderBy(asc(blocks.rank), asc(blocks.id));

        let prev: string | null = null;
        for (const row of rows) {
          const newRank: string = prev ? rankAfter(prev) : rankInitial();
          if (newRank !== row.rank) {
            await tx
              .update(blocks)
              .set({ rank: newRank, updatedAt: new Date() })
              .where(eq(blocks.id, row.id));
          }
          prev = newRank;
        }
      };

      const resolveBounds = async () => {
        let lowerRank: string | null = null;
        let upperRank: string | null = null;

        if (before) {
          upperRank = before.rank;
          const prev = after ? null : await prevSibling(before.rank, before.id);
          lowerRank = after?.rank ?? prev?.rank ?? null;
        }

        if (after) {
          lowerRank = after.rank;
          if (!before) {
            const next = await nextSibling(after.rank, after.id);
            upperRank = next?.rank ?? null;
          }
        }

        if (!before && !after) {
          throw Errors.VALIDATION_ERROR([
            {
              code: "custom",
              message: "beforeId or afterId is required",
              path: ["beforeId", "afterId"],
            },
          ]);
        }

        if (lowerRank && upperRank && compareRanks(lowerRank, upperRank) >= 0) {
          throw Errors.VALIDATION_ERROR([
            {
              code: "custom",
              message: "Invalid anchor order",
              path: ["afterId", "beforeId"],
            },
          ]);
        }

        return { lowerRank, upperRank };
      };

      let bounds = await resolveBounds();
      let newRank: string;
      try {
        newRank = rankBetween(bounds.lowerRank, bounds.upperRank);
      } catch (error) {
        if (!isAppError(error) || error.code !== "RANK_EXHAUSTED") throw error;

        await rebuildRanks();

        const refreshedCurrent = await tx
          .select({ id: blocks.id, noteId: blocks.noteId, rank: blocks.rank })
          .from(blocks)
          .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));
        current = refreshedCurrent[0];
        if (!current) throw Errors.BLOCK_NOT_FOUND(input.blockId);

        before = input.beforeId ? await readAnchor(input.beforeId) : null;
        after = input.afterId ? await readAnchor(input.afterId) : null;

        bounds = await resolveBounds();
        newRank = rankBetween(bounds.lowerRank, bounds.upperRank);
      }

      if (current.rank === newRank) {
        return { moved: false, rank: current.rank };
      }

      await tx
        .update(blocks)
        .set({ rank: newRank, updatedAt: new Date() })
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, current.id)));

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

export async function rebuildBlockRanks(input: { userId?: string; noteId?: string }) {
  try {
    await db.transaction(async (tx) => {
      const where = and(
        input.userId ? eq(blocks.userId, input.userId) : sql`true`,
        input.noteId ? eq(blocks.noteId, input.noteId) : sql`true`,
      );

      const noteRows = await tx.selectDistinct({ noteId: blocks.noteId }).from(blocks).where(where);

      for (const note of noteRows) {
        const rows = await tx
          .select({ id: blocks.id, rank: blocks.rank })
          .from(blocks)
          .where(
            and(
              eq(blocks.noteId, note.noteId),
              input.userId ? eq(blocks.userId, input.userId) : sql`true`,
            ),
          )
          .orderBy(asc(blocks.rank), asc(blocks.id));

        let prev: string | null = null;
        for (const row of rows) {
          const newRank: string = prev ? rankAfter(prev) : rankInitial();
          if (newRank !== row.rank) {
            await tx.update(blocks).set({ rank: newRank }).where(eq(blocks.id, row.id));
          }
          prev = newRank;
        }
      }
    });

    return Ok({ rebuilt: true });
  } catch {
    return Err(Errors.DB_ERROR());
  }
}
