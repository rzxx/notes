"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";

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
