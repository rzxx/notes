import { z } from "zod";

export const blockTypeSchema = z.enum([
  "paragraph",
  "heading",
  "bulleted_list_item",
  "numbered_list_item",
  "todo",
  "quote",
  "code",
]);

export type BlockType = z.infer<typeof blockTypeSchema>;

const textContentSchema = z
  .object({
    text: z.string().optional(),
  })
  .strict();

const todoContentSchema = z
  .object({
    text: z.string().optional(),
    checked: z.boolean().optional(),
  })
  .strict();

const codeContentSchema = z
  .object({
    text: z.string().optional(),
    language: z.string().optional(),
  })
  .strict();

export const blockContentSchemaByType = {
  paragraph: textContentSchema,
  heading: textContentSchema,
  bulleted_list_item: textContentSchema,
  numbered_list_item: textContentSchema,
  todo: todoContentSchema,
  quote: textContentSchema,
  code: codeContentSchema,
} as const satisfies Record<BlockType, z.ZodTypeAny>;

const blockContentSchemas = Object.values(blockContentSchemaByType) as z.ZodTypeAny[];

export const blockContentSchema = z.union(
  blockContentSchemas as [z.ZodTypeAny, ...z.ZodTypeAny[]],
) as z.ZodType<BlockContent>;

export type BlockContentByType = {
  [K in BlockType]: z.infer<(typeof blockContentSchemaByType)[K]>;
};

export type BlockContent = BlockContentByType[BlockType];

export function getBlockTextFromContent(input: {
  type: string;
  contentJson: unknown;
  plainText?: string;
}) {
  const schema = blockContentSchemaByType[input.type as BlockType];
  if (schema) {
    const parsed = schema.safeParse(input.contentJson);
    if (parsed.success) return parsed.data.text ?? input.plainText ?? "";
  }

  const fallback = blockContentSchema.safeParse(input.contentJson);
  if (fallback.success) return fallback.data.text ?? input.plainText ?? "";

  return input.plainText ?? "";
}
