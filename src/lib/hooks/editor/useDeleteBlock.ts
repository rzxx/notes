"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteDetailResponse } from "@/lib/hooks/editor/types";
import { removeBlockById, sortBlocks } from "@/lib/editor/block-list";
import { authHeaders } from "@/lib/auth/client";
import { useAuthToken } from "@/lib/auth/client";

type DeleteBlockInput = {
  noteId: string;
  blockId: string;
};

type DeleteBlockResponse = {
  ok: true;
  deleted: boolean;
};

export function useDeleteBlock() {
  const queryClient = useQueryClient();
  const { token } = useAuthToken();

  return useMutation({
    mutationFn: async (input: DeleteBlockInput) => {
      const result = await fetchResult<DeleteBlockResponse>(`/api/blocks/${input.blockId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      if (!result.ok) throw result.error;
      return result.value;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });

      const key = queryKeys.notes.detail(variables.noteId);
      const previous = queryClient.getQueryData<NoteDetailResponse>(key);
      if (!previous) return { previous: null } as const;

      const remaining = removeBlockById(previous.blocks, variables.blockId);
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
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
    },
  });
}
