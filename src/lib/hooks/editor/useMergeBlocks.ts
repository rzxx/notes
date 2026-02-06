"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteDetailResponse, NoteBlock } from "@/lib/hooks/editor/types";
import { removeBlockById, replaceBlockById, sortBlocks } from "@/lib/editor/block-list";

type MergeBlocksInput = {
  noteId: string;
  prevBlockId: string;
  currentBlockId: string;
  mergedText: string;
};

type MergeBlocksResponse = {
  ok: true;
  block: NoteBlock;
};

async function mergeBlocks(input: MergeBlocksInput) {
  const result = await fetchResult<MergeBlocksResponse>("/api/blocks/merge", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prevBlockId: input.prevBlockId,
      currentBlockId: input.currentBlockId,
      mergedText: input.mergedText,
    }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useMergeBlocks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mergeBlocks,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });

      const key = queryKeys.notes.detail(variables.noteId);
      const previous = queryClient.getQueryData<NoteDetailResponse>(key);
      if (!previous) return { previous: null } as const;

      const prev = previous.blocks.find((block) => block.id === variables.prevBlockId);
      const current = previous.blocks.find((block) => block.id === variables.currentBlockId);
      if (!prev || !current) return { previous } as const;

      const now = new Date().toISOString();
      const updatedBlocks = replaceBlockById(previous.blocks, variables.prevBlockId, {
        ...prev,
        contentJson: { text: variables.mergedText },
        plainText: variables.mergedText,
        updatedAt: now,
      });

      const remaining = removeBlockById(updatedBlocks, variables.currentBlockId);
      queryClient.setQueryData<NoteDetailResponse>(key, {
        ...previous,
        blocks: sortBlocks(remaining),
      });

      return { previous } as const;
    },
    onError: (_error, variables, context) => {
      if (!context?.previous) return;
      queryClient.setQueryData(queryKeys.notes.detail(variables.noteId), context.previous);
    },
    onSuccess: (data, variables) => {
      const key = queryKeys.notes.detail(variables.noteId);
      queryClient.setQueryData<NoteDetailResponse>(key, (current) => {
        if (!current) return current;
        const blocks = current.blocks.map((block) =>
          block.id === data.block.id ? data.block : block,
        );
        return { ...current, blocks };
      });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
    },
  });
}
