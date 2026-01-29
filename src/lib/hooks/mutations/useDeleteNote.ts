"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useTreeStore } from "@/lib/stores/tree";

type DeleteNoteInput = {
  noteId: string;
  parentId: string | null;
};

type DeleteNoteResponse = {
  ok: true;
  note: { deleted: boolean };
};

async function deleteNote(input: DeleteNoteInput) {
  const result = await fetchResult<DeleteNoteResponse>("/api/notes", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ noteId: input.noteId }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNote,
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(variables.noteId) }),
        queryClient.cancelQueries({ queryKey: queryKeys.notes.list(variables.parentId) }),
      ]);

      const state = useTreeStore.getState();
      const snapshot = state.deleteNodeAndLift(variables.noteId);

      return snapshot ? { snapshot } : null;
    },
    onError: (_error, _variables, context) => {
      if (!context?.snapshot) return;
      const { node, meta, parentId, index, childrenIds } = context.snapshot;
      const state = useTreeStore.getState();
      state.restoreNode({ node, meta, parentId, index });
      childrenIds?.forEach((childId) => {
        state.moveNode(childId, node.id);
      });
    },
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.list(context?.snapshot?.parentId ?? variables.parentId ?? null),
      });
    },
  });
}
