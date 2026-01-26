"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type NoteDetail = {
  id: string;
  parentId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type NoteBlock = {
  id: string;
  type: string;
  position: number;
  contentJson: unknown;
  plainText: string;
  createdAt: string;
  updatedAt: string;
};

type NoteResponse = {
  ok: true;
  note: NoteDetail;
  blocks: NoteBlock[];
};

async function fetchNote(noteId: string) {
  const result = await fetchResult<NoteResponse>(`/api/notes/${noteId}`, {
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
