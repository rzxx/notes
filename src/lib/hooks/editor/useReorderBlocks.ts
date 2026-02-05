"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteDetailResponse } from "@/lib/hooks/editor/types";
import { reorderBlocksByIds } from "@/lib/editor/block-list";

type ReorderBlocksInput = {
  noteId: string;
  orderedBlockIds: string[];
};

type ReorderBlocksResponse = {
  ok: true;
  reordered: boolean;
};

async function reorderBlocks(input: ReorderBlocksInput) {
  const result = await fetchResult<ReorderBlocksResponse>("/api/blocks/reorder", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      noteId: input.noteId,
      orderedBlockIds: input.orderedBlockIds,
    }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useReorderBlocks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderBlocks,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });

      const key = queryKeys.notes.detail(variables.noteId);
      const previous = queryClient.getQueryData<NoteDetailResponse>(key);
      if (!previous) return { previous: null } as const;

      const reordered = reorderBlocksByIds(previous.blocks, variables.orderedBlockIds);
      if (!reordered) return { previous } as const;

      queryClient.setQueryData<NoteDetailResponse>(key, { ...previous, blocks: reordered });
      return { previous } as const;
    },
    onError: (_error, variables, context) => {
      if (!context?.previous) return;
      queryClient.setQueryData(queryKeys.notes.detail(variables.noteId), context.previous);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
    },
  });
}
