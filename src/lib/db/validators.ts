import { z } from "zod";
import {
  blockContentSchema,
  blockContentSchemaByType,
  blockTypeSchema,
  type BlockType,
} from "@/lib/editor/block-content";

export { blockTypeSchema };

export const noteTitleSchema = z.string().trim().min(1).max(200);

export const createNoteSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  title: noteTitleSchema,
});

export const moveNoteSchema = z
  .object({
    noteId: z.uuid(),
    newParentId: z.uuid().nullable(),
    beforeId: z.uuid().nullable().optional(),
    afterId: z.uuid().nullable().optional(),
  })
  .refine((data) => !(data.beforeId && data.afterId && data.beforeId === data.afterId), {
    path: ["beforeId", "afterId"],
    message: "beforeId and afterId cannot be identical",
  });

export const deleteNoteSchema = z.object({
  noteId: z.uuid(),
});

export const getNoteListSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});

export const noteIdParamSchema = z.object({
  id: z.uuid(),
});

export const blockIdParamSchema = z.object({
  id: z.uuid(),
});

export const updateNoteSchema = z.object({
  title: noteTitleSchema,
});

const addContentIssues = (
  ctx: z.RefinementCtx,
  issues: z.ZodIssue[],
  path: (string | number)[] = ["contentJson"],
) => {
  for (const issue of issues) {
    ctx.addIssue({ ...issue, path: [...path, ...issue.path] });
  }
};

export const createBlockSchema = z
  .object({
    noteId: z.uuid(),
    type: blockTypeSchema,
    position: z.number().int().min(0),
    contentJson: z.unknown().optional(),
    plainText: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.contentJson === undefined) return;
    const schema = blockContentSchemaByType[data.type as BlockType];
    const parsed = schema.safeParse(data.contentJson);
    if (!parsed.success) addContentIssues(ctx, parsed.error.issues);
  });

export const updateBlockSchema = z
  .object({
    type: blockTypeSchema.optional(),
    contentJson: z.unknown().optional(),
    plainText: z.string().optional(),
  })
  .refine(
    (data) =>
      data.type !== undefined || data.contentJson !== undefined || data.plainText !== undefined,
    { message: "At least one field is required" },
  )
  .superRefine((data, ctx) => {
    if (data.contentJson === undefined) return;
    if (data.type) {
      const schema = blockContentSchemaByType[data.type as BlockType];
      const parsed = schema.safeParse(data.contentJson);
      if (!parsed.success) addContentIssues(ctx, parsed.error.issues);
      return;
    }

    const parsed = blockContentSchema.safeParse(data.contentJson);
    if (!parsed.success) addContentIssues(ctx, parsed.error.issues);
  });

export const reorderBlocksSchema = z.object({
  noteId: z.uuid(),
  // simplest v1: send ordered ids; server assigns 0..n-1
  orderedBlockIds: z.array(z.uuid()).min(1),
});

export const splitBlockSchema = z.object({
  blockId: z.uuid(),
  beforeText: z.string(),
  afterText: z.string(),
});

export const mergeBlocksSchema = z.object({
  prevBlockId: z.uuid(),
  currentBlockId: z.uuid(),
  mergedText: z.string(),
});
