import "server-only";
import { db } from "./drizzle";
import { blocks, notes } from "./schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Err, Ok } from "@/lib/result";
import { Errors, isAppError } from "@/lib/errors";
import { buildTextBlockContent } from "@/lib/editor/block-content";

type BlockRow = {
  id: string;
  noteId: string;
  type: string;
  position: number;
  contentJson: unknown;
  plainText: string;
  createdAt: Date;
  updatedAt: Date;
};

const selectBlock = {
  id: blocks.id,
  noteId: blocks.noteId,
  type: blocks.type,
  position: blocks.position,
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

      const countRows = await tx
        .select({ count: sql<number>`count(*)` })
        .from(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, input.noteId)));

      const total = Number(countRows[0]?.count ?? 0);
      const clampedPosition = Math.max(0, Math.min(input.position, total));

      if (clampedPosition < total) {
        const tempOffset = 1_000_000;
        await tx
          .update(blocks)
          .set({ position: sql`${blocks.position} + ${tempOffset}` })
          .where(
            and(
              eq(blocks.userId, input.userId),
              eq(blocks.noteId, input.noteId),
              sql`${blocks.position} >= ${clampedPosition}`,
            ),
          );

        const inserted = await tx
          .insert(blocks)
          .values({
            userId: input.userId,
            noteId: input.noteId,
            type: input.type,
            position: clampedPosition,
            contentJson: input.contentJson ?? {},
            plainText: input.plainText ?? "",
          })
          .returning(selectBlock);

        if (!inserted[0]) throw Errors.DB_ERROR();

        await tx
          .update(blocks)
          .set({ position: sql`${blocks.position} - ${tempOffset} + 1` })
          .where(
            and(
              eq(blocks.userId, input.userId),
              eq(blocks.noteId, input.noteId),
              sql`${blocks.position} >= ${tempOffset + clampedPosition}`,
            ),
          );

        return inserted[0] as BlockRow;
      }

      const inserted = await tx
        .insert(blocks)
        .values({
          userId: input.userId,
          noteId: input.noteId,
          type: input.type,
          position: clampedPosition,
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

      const block = existing[0];
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

      const countRows = await tx
        .select({ count: sql<number>`count(*)` })
        .from(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, block.noteId)));

      const total = Number(countRows[0]?.count ?? 0);
      const insertPosition = Math.min(block.position + 1, total);

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

      if (insertPosition < total) {
        const tempOffset = 1_000_000;
        await tx
          .update(blocks)
          .set({ position: sql`${blocks.position} + ${tempOffset}` })
          .where(
            and(
              eq(blocks.userId, input.userId),
              eq(blocks.noteId, block.noteId),
              sql`${blocks.position} >= ${insertPosition}`,
            ),
          );

        const inserted = await tx
          .insert(blocks)
          .values({
            userId: input.userId,
            noteId: block.noteId,
            type: block.type,
            position: insertPosition,
            contentJson: afterContent.value,
            plainText: input.afterText,
          })
          .returning(selectBlock);

        if (!inserted[0]) throw Errors.DB_ERROR();

        await tx
          .update(blocks)
          .set({ position: sql`${blocks.position} - ${tempOffset} + 1` })
          .where(
            and(
              eq(blocks.userId, input.userId),
              eq(blocks.noteId, block.noteId),
              sql`${blocks.position} >= ${tempOffset + insertPosition}`,
            ),
          );

        return { block: updated[0] as BlockRow, newBlock: inserted[0] as BlockRow };
      }

      const inserted = await tx
        .insert(blocks)
        .values({
          userId: input.userId,
          noteId: block.noteId,
          type: block.type,
          position: insertPosition,
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
      if (prev.position >= current.position) {
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

      const tempOffset = 1_000_000;
      await tx
        .update(blocks)
        .set({ position: sql`${blocks.position} + ${tempOffset}` })
        .where(
          and(
            eq(blocks.userId, input.userId),
            eq(blocks.noteId, current.noteId),
            sql`${blocks.position} > ${current.position}`,
          ),
        );

      await tx
        .update(blocks)
        .set({ position: sql`${blocks.position} - ${tempOffset} - 1` })
        .where(
          and(
            eq(blocks.userId, input.userId),
            eq(blocks.noteId, current.noteId),
            sql`${blocks.position} >= ${tempOffset + current.position + 1}`,
          ),
        );

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
        .select({ id: blocks.id, noteId: blocks.noteId, position: blocks.position })
        .from(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));

      const block = existing[0];
      if (!block) throw Errors.BLOCK_NOT_FOUND(input.blockId);

      await tx
        .delete(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.id, input.blockId)));

      const tempOffset = 1_000_000;
      await tx
        .update(blocks)
        .set({ position: sql`${blocks.position} + ${tempOffset}` })
        .where(
          and(
            eq(blocks.userId, input.userId),
            eq(blocks.noteId, block.noteId),
            sql`${blocks.position} > ${block.position}`,
          ),
        );

      await tx
        .update(blocks)
        .set({ position: sql`${blocks.position} - ${tempOffset} - 1` })
        .where(
          and(
            eq(blocks.userId, input.userId),
            eq(blocks.noteId, block.noteId),
            sql`${blocks.position} >= ${tempOffset + block.position + 1}`,
          ),
        );
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
  orderedBlockIds: string[];
}) {
  try {
    await db.transaction(async (tx) => {
      const noteRows = await tx
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.userId, input.userId), eq(notes.id, input.noteId)));

      if (!noteRows[0]) throw Errors.NOTE_NOT_FOUND(input.noteId);

      const existing = await tx
        .select({ id: blocks.id })
        .from(blocks)
        .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, input.noteId)));

      const existingIds = new Set(existing.map((row) => row.id));
      const orderedIds = new Set(input.orderedBlockIds);

      if (
        existingIds.size !== orderedIds.size ||
        input.orderedBlockIds.some((id) => !existingIds.has(id))
      ) {
        throw Errors.VALIDATION_ERROR([
          {
            code: "custom",
            message: "orderedBlockIds must include all blocks",
            path: ["orderedBlockIds"],
          },
        ]);
      }

      const tempOffset = 1_000_000;
      await tx
        .update(blocks)
        .set({ position: sql`${blocks.position} + ${tempOffset}` })
        .where(and(eq(blocks.userId, input.userId), eq(blocks.noteId, input.noteId)));

      for (let index = 0; index < input.orderedBlockIds.length; index += 1) {
        const blockId = input.orderedBlockIds[index];
        await tx
          .update(blocks)
          .set({ position: index })
          .where(
            and(
              eq(blocks.userId, input.userId),
              eq(blocks.noteId, input.noteId),
              eq(blocks.id, blockId),
            ),
          );
      }
    });

    return Ok({ reordered: true });
  } catch (e) {
    if (isAppError(e) && e.code !== "DB_ERROR") {
      return Err(e);
    }
    return Err(Errors.DB_ERROR());
  }
}
