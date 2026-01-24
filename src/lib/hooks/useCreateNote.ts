"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { useTreeStore } from "@/lib/stores/tree";

type CreateNoteInput = {
  parentId: string | null;
  title: string;
};

type CreateNoteResponse = {
  ok: true;
  note: { id: string };
};

async function createNote(input: CreateNoteInput) {
  const result = await fetchResult<CreateNoteResponse>("/api/notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      parentId: input.parentId ?? null,
      title: input.title,
    }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNote,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["notes", variables.parentId] });

      const tempId = `temp-${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(16).slice(2)
      }`;
      const state = useTreeStore.getState();

      const pagination =
        variables.parentId === null ? state.rootPagination : state.meta[variables.parentId];

      state.upsertNodes(
        variables.parentId,
        [
          {
            id: tempId,
            parentId: variables.parentId,
            title: variables.title,
            hasChildren: false,
          },
        ],
        { hasMore: pagination?.hasMore ?? false, nextCursor: pagination?.nextCursor ?? null },
      );

      if (variables.parentId) {
        state.toggleExpanded(variables.parentId, true);
      }

      return { tempId };
    },
    onError: (_error, _variables, context) => {
      if (context?.tempId) {
        useTreeStore.getState().removeNode(context.tempId);
      }
    },
    onSuccess: (data, variables, context) => {
      const state = useTreeStore.getState();

      if (context?.tempId) {
        state.removeNode(context.tempId);
      }

      const pagination =
        variables.parentId === null ? state.rootPagination : state.meta[variables.parentId];

      state.upsertNodes(
        variables.parentId,
        [
          {
            id: data.note.id,
            parentId: variables.parentId,
            title: variables.title,
            hasChildren: false,
          },
        ],
        { hasMore: pagination?.hasMore ?? false, nextCursor: pagination?.nextCursor ?? null },
      );
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notes", variables.parentId] });
    },
  });
}
