"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useTreeStore } from "@/lib/stores/tree";

type MoveNoteInput = {
  noteId: string;
  newParentId: string | null;
  previousParentId: string | null;
  beforeId?: string | null;
  afterId?: string | null;
  optimistic?: boolean;
  snapshot?: { oldParentId: string | null; oldIndex: number } | null;
};

type MoveNoteResponse = {
  ok: true;
  moved: boolean;
  rank?: string;
};

async function moveNote(input: MoveNoteInput) {
  const result = await fetchResult<MoveNoteResponse>("/api/notes/move", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      noteId: input.noteId,
      newParentId: input.newParentId,
      beforeId: input.beforeId ?? null,
      afterId: input.afterId ?? null,
    }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useMoveNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: moveNote,
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.notes.list(variables.previousParentId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.notes.list(variables.newParentId) }),
      ]);

      if (variables.optimistic === false) {
        return variables.snapshot ? { snapshot: variables.snapshot } : null;
      }

      const state = useTreeStore.getState();
      const snapshot = state.moveNodeWithSnapshot(variables.noteId, variables.newParentId ?? null, {
        beforeId: variables.beforeId ?? null,
        afterId: variables.afterId ?? null,
      });

      return snapshot ? { snapshot } : null;
    },
    onError: (_error, variables, context) => {
      if (context?.snapshot) {
        useTreeStore.getState().moveNode(variables.noteId, context.snapshot.oldParentId ?? null);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.list(variables.previousParentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.list(variables.newParentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.list(variables.previousParentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.list(variables.newParentId) });
    },
  });
}
