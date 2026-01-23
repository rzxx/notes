"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";

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
