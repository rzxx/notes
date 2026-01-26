"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useTreeStore } from "@/lib/stores/tree";

type RenameNoteInput = {
  noteId: string;
  title: string;
  parentId: string | null;
};

type RenameNoteResponse = {
  ok: true;
  note: { id: string; title: string };
};

async function renameNote(input: RenameNoteInput) {
  const result = await fetchResult<RenameNoteResponse>(`/api/notes/${input.noteId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: input.title }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useRenameNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: renameNote,
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(variables.noteId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.notes.list(variables.parentId) }),
      ]);

      const state = useTreeStore.getState();
      const existing = state.nodes[variables.noteId];
      const parentId = existing?.parentId ?? variables.parentId ?? null;
      const pagination = parentId === null ? state.rootPagination : state.meta[parentId];

      const optimistic = existing
        ? { ...existing, title: variables.title }
        : {
            id: variables.noteId,
            parentId,
            title: variables.title,
            hasChildren: false,
            createdAt: new Date().toISOString(),
          };

      state.upsertNodes(parentId, [optimistic], {
        hasMore: pagination?.hasMore ?? false,
        nextCursor: pagination?.nextCursor ?? null,
      });

      return { previousNode: existing, parentId } as const;
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousNode) return;

      const state = useTreeStore.getState();
      const pagination =
        context.parentId === null ? state.rootPagination : state.meta[context.parentId];

      state.upsertNodes(context.parentId, [context.previousNode], {
        hasMore: pagination?.hasMore ?? false,
        nextCursor: pagination?.nextCursor ?? null,
      });
    },
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.list(context?.parentId ?? variables.parentId ?? null),
      });
    },
  });
}
