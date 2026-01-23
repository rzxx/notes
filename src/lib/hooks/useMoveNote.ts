"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const response = await fetch("/api/notes/move", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      noteId: input.noteId,
      newParentId: input.newParentId,
    }),
  });

  const payload = (await response.json()) as MoveNoteResponse;
  if (!response.ok) {
    throw new Error(payload ? JSON.stringify(payload) : "Request failed");
  }

  return payload;
}

export function useMoveNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: moveNote,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["note", variables.noteId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notes-children", variables.previousParentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notes-children", variables.newParentId],
      });
    },
  });
}
