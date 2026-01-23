"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";

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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["notes-children", variables.parentId],
      });
    },
  });
}
