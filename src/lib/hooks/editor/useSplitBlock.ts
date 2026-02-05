"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteBlock, NoteDetailResponse } from "@/lib/hooks/editor/types";
import { insertBlockAt, replaceBlockById, sortBlocks } from "@/lib/editor/block-list";

type SplitBlockInput = {
  noteId: string;
  blockId: string;
  beforeText: string;
  afterText: string;
  tempId?: string;
};

type SplitBlockResponse = {
  ok: true;
  block: NoteBlock;
  newBlock: NoteBlock;
};

export const makeTempId = () =>
  `temp-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2)
  }`;

async function splitBlock(input: SplitBlockInput) {
  const result = await fetchResult<SplitBlockResponse>("/api/blocks/split", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      blockId: input.blockId,
      beforeText: input.beforeText,
      afterText: input.afterText,
    }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useSplitBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: splitBlock,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });

      const key = queryKeys.notes.detail(variables.noteId);
      const previous = queryClient.getQueryData<NoteDetailResponse>(key);
      if (!previous) return { previous: null, tempId: null } as const;

      const target = previous.blocks.find((block) => block.id === variables.blockId);
      if (!target) return { previous, tempId: null } as const;

      const tempId = variables.tempId ?? makeTempId();
      const now = new Date().toISOString();
      const tempBlock: NoteBlock = {
        id: tempId,
        type: target.type,
        position: target.position + 1,
        contentJson: { text: variables.afterText },
        plainText: variables.afterText,
        createdAt: now,
        updatedAt: now,
      };

      const updatedBlocks = previous.blocks.map((block) =>
        block.id === variables.blockId
          ? {
              ...block,
              contentJson: { text: variables.beforeText },
              plainText: variables.beforeText,
              updatedAt: now,
            }
          : block,
      );

      const blocks = insertBlockAt(updatedBlocks, tempBlock, target.position + 1);
      queryClient.setQueryData<NoteDetailResponse>(key, { ...previous, blocks });

      return { previous, tempId } as const;
    },
    onError: (_error, variables, context) => {
      if (!context?.previous) return;
      queryClient.setQueryData(queryKeys.notes.detail(variables.noteId), context.previous);
    },
    onSuccess: (data, variables, context) => {
      const key = queryKeys.notes.detail(variables.noteId);
      queryClient.setQueryData<NoteDetailResponse>(key, (current) => {
        if (!current) return current;
        let replaced = replaceBlockById(current.blocks, data.block.id, data.block);
        if (context?.tempId) {
          replaced = replaceBlockById(replaced, context.tempId, data.newBlock);
        }
        return { ...current, blocks: sortBlocks(replaced) };
      });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
    },
  });
}
