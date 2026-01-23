"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

type CreateNoteInput = {
  parentId?: string | null;
  title: string;
};

type CreateNoteResponse = {
  ok: true;
  note: { id: string };
};

async function createNote(input: CreateNoteInput) {
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      parentId: input.parentId ?? null,
      title: input.title,
    }),
  });

  const payload = (await response.json()) as CreateNoteResponse;
  if (!response.ok) {
    throw new Error(payload ? JSON.stringify(payload) : "Request failed");
  }

  return payload;
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNote,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["notes-children", variables.parentId ?? null],
      });
    },
  });
}
