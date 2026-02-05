"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteDetailResponse } from "@/lib/hooks/editor/types";

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

      const blockMap = new Map(previous.blocks.map((block) => [block.id, block] as const));
      if (blockMap.size !== variables.orderedBlockIds.length) {
        return { previous } as const;
      }

      const reordered = variables.orderedBlockIds
        .map((id, index) => {
          const block = blockMap.get(id);
          if (!block) return null;
          return { ...block, position: index };
        })
        .filter((block): block is NonNullable<typeof block> => Boolean(block));

      if (reordered.length !== previous.blocks.length) {
        return { previous } as const;
      }

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
