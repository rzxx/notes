"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";

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
  const result = await fetchResult<RenameNoteResponse>(`/api/notes/${input.noteId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: input.title }),
  });

  if (!result.ok) throw result.error;
  return result.value;
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
