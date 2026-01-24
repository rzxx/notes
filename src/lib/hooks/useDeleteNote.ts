"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
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
        queryClient.cancelQueries({ queryKey: ["note", variables.noteId] }),
        queryClient.cancelQueries({ queryKey: ["notes", variables.parentId] }),
      ]);

      const state = useTreeStore.getState();
      const node = state.nodes[variables.noteId];
      const meta = state.meta[variables.noteId];
      const parentId = node?.parentId ?? variables.parentId ?? null;
      const parentMeta = parentId === null ? null : state.meta[parentId];
      const index =
        parentId === null
          ? state.rootIds.indexOf(variables.noteId)
          : (parentMeta?.childrenIds.indexOf(variables.noteId) ?? -1);

      state.removeNode(variables.noteId);

      return node
        ? {
            snapshot: {
              node,
              meta,
              parentId,
              index,
            },
          }
        : null;
    },
    onError: (_error, _variables, context) => {
      if (!context?.snapshot) return;
      const { node, meta, parentId, index } = context.snapshot;
      useTreeStore.getState().restoreNode({ node, meta, parentId, index });
    },
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["note", variables.noteId] });
      queryClient.invalidateQueries({
        queryKey: ["notes", context?.snapshot?.parentId ?? variables.parentId ?? null],
      });
    },
  });
}
