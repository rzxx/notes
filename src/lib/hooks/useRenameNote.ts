"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const response = await fetch(`/api/notes/${input.noteId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: input.title }),
  });

  const payload = (await response.json()) as RenameNoteResponse;
  if (!response.ok) {
    throw new Error(payload ? JSON.stringify(payload) : "Request failed");
  }

  return payload;
}

export function useRenameNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: renameNote,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["note", variables.noteId],
      });

      queryClient.invalidateQueries({
        queryKey: ["notes-children", variables.parentId],
      });
    },
  });
}
