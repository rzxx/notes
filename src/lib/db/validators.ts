import { z } from "zod";

export const noteTitleSchema = z.string().trim().min(1).max(200);

export const createNoteSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  title: noteTitleSchema,
});

export const moveNoteSchema = z.object({
  noteId: z.uuid(),
  newParentId: z.uuid().nullable(),
});

export const deleteNoteSchema = z.object({
  noteId: z.uuid(),
});

export const blockTypeSchema = z.enum([
  "paragraph",
  "heading",
  "bulleted_list_item",
  "numbered_list_item",
  "todo",
  "quote",
  "code",
]);

export const createBlockSchema = z.object({
  noteId: z.uuid(),
  type: blockTypeSchema,
  position: z.number().int().min(0),
  contentJson: z.unknown().optional(), // tighten later per type
  plainText: z.string().optional(),
});

export const reorderBlocksSchema = z.object({
  noteId: z.uuid(),
  // simplest v1: send ordered ids; server assigns 0..n-1
  orderedBlockIds: z.array(z.uuid()).min(1),
});
