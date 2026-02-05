"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteBlock, NoteDetailResponse } from "@/lib/hooks/editor/types";
import { insertBlockAt, replaceBlockById, sortBlocks } from "@/lib/editor/block-list";

type CreateBlockInput = {
  noteId: string;
  type: string;
  position: number;
  contentJson?: unknown;
  plainText?: string;
};

type CreateBlockResponse = {
  ok: true;
  block: NoteBlock;
};

const makeTempId = () =>
  `temp-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2)
  }`;

async function createBlock(input: CreateBlockInput) {
  const result = await fetchResult<CreateBlockResponse>("/api/blocks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      noteId: input.noteId,
      type: input.type,
      position: input.position,
      contentJson: input.contentJson,
      plainText: input.plainText,
    }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useCreateBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBlock,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });

      const key = queryKeys.notes.detail(variables.noteId);
      const previous = queryClient.getQueryData<NoteDetailResponse>(key);
      if (!previous) return { previous: null, tempId: null } as const;

      const tempId = makeTempId();
      const now = new Date().toISOString();
      const tempBlock: NoteBlock = {
        id: tempId,
        type: variables.type,
        position: variables.position,
        contentJson: variables.contentJson ?? { text: "" },
        plainText: variables.plainText ?? "",
        createdAt: now,
        updatedAt: now,
      };

      const blocks = insertBlockAt(previous.blocks, tempBlock, variables.position);
      queryClient.setQueryData<NoteDetailResponse>(key, { ...previous, blocks });

      return { previous, tempId } as const;
    },
    onError: (_error, _variables, context) => {
      if (!context?.previous) return;
      queryClient.setQueryData(queryKeys.notes.detail(context.previous.note.id), context.previous);
    },
    onSuccess: (data, variables, context) => {
      if (!context?.tempId) return;
      const key = queryKeys.notes.detail(variables.noteId);
      queryClient.setQueryData<NoteDetailResponse>(key, (current) => {
        if (!current) return current;
        const replaced = replaceBlockById(current.blocks, context.tempId, data.block);
        return { ...current, blocks: sortBlocks(replaced) };
      });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
    },
  });
}
