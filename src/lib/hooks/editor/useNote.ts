"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteDetailResponse } from "@/lib/hooks/editor/types";

async function fetchNote(noteId: string) {
  const result = await fetchResult<NoteDetailResponse>(`/api/notes/${noteId}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useNote(noteId: string | null) {
  return useQuery({
    queryKey: queryKeys.notes.detail(noteId),
    queryFn: () => fetchNote(noteId as string),
    enabled: Boolean(noteId),
  });
}
