"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useTreeStore } from "@/lib/stores/tree";

type MoveNoteInput = {
  noteId: string;
  newParentId: string | null;
  previousParentId: string | null;
};

type MoveNoteResponse = {
  ok: true;
  moved: boolean;
};

async function moveNote(input: MoveNoteInput) {
  const result = await fetchResult<MoveNoteResponse>("/api/notes/move", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      noteId: input.noteId,
      newParentId: input.newParentId,
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

      const state = useTreeStore.getState();
      const node = state.nodes[variables.noteId];
      const oldParentId = node?.parentId ?? variables.previousParentId ?? null;
      const oldIndex =
        oldParentId === null
          ? state.rootIds.indexOf(variables.noteId)
          : (state.meta[oldParentId]?.childrenIds.indexOf(variables.noteId) ?? -1);

      state.moveNode(variables.noteId, variables.newParentId ?? null);

      return { nodeExists: Boolean(node), oldParentId, oldIndex } as const;
    },
    onError: (_error, variables, context) => {
      if (!context?.nodeExists) return;
      useTreeStore
        .getState()
        .moveNode(variables.noteId, context.oldParentId ?? null, context.oldIndex);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.list(variables.previousParentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.list(variables.newParentId) });
    },
  });
}
