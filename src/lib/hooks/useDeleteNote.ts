"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

type DeleteNoteInput = {
  noteId: string;
  parentId: string | null;
};

type DeleteNoteResponse = {
  ok: true;
  note: { deleted: boolean };
};

async function deleteNote(input: DeleteNoteInput) {
  const response = await fetch("/api/notes", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ noteId: input.noteId }),
  });

  const payload = (await response.json()) as DeleteNoteResponse;
  if (!response.ok) {
    throw new Error(payload ? JSON.stringify(payload) : "Request failed");
  }

  return payload;
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNote,
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
