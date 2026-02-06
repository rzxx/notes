import { z } from "zod";
import { Err, Ok, type Result } from "@/lib/result";
import { Errors, type AppError } from "@/lib/errors";

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

const textContentSchema = z.strictObject({
  text: z.string().optional(),
});

const todoContentSchema = z.strictObject({
  text: z.string().optional(),
  checked: z.boolean().optional(),
});

const codeContentSchema = z.strictObject({
  text: z.string().optional(),
  language: z.string().optional(),
});

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

const withPathPrefix = (issues: z.ZodIssue[], prefix: (string | number)[]) =>
  issues.map((issue) => ({
    ...issue,
    path: [...prefix, ...issue.path],
  }));

export function parseBlockContentByType(input: {
  type: string;
  contentJson: unknown;
}): Result<{ type: BlockType; data: BlockContent }, AppError> {
  const typeResult = blockTypeSchema.safeParse(input.type);
  if (!typeResult.success) {
    return Err(Errors.VALIDATION_ERROR(withPathPrefix(typeResult.error.issues, ["type"])));
  }

  const schema = blockContentSchemaByType[typeResult.data];
  const contentResult = schema.safeParse(input.contentJson);
  if (!contentResult.success) {
    return Err(
      Errors.VALIDATION_ERROR(withPathPrefix(contentResult.error.issues, ["contentJson"])),
    );
  }

  return Ok({
    type: typeResult.data,
    data: contentResult.data,
  });
}

export function buildTextBlockContent(input: {
  type: string;
  text: string;
}): Result<BlockContent, AppError> {
  const parsed = parseBlockContentByType({
    type: input.type,
    contentJson: { text: input.text },
  });

  if (!parsed.ok) return parsed;
  return Ok(parsed.value.data);
}

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
