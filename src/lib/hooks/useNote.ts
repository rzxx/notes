"use client";

import { useQuery } from "@tanstack/react-query";

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
  const response = await fetch(`/api/notes/${noteId}`, {
    method: "GET",
    headers: { "content-type": "application/json" },
  });

  const payload = (await response.json()) as NoteResponse;
  if (!response.ok) {
    throw new Error(payload ? JSON.stringify(payload) : "Request failed");
  }

  return payload;
}

export function useNote(noteId?: string | null) {
  return useQuery({
    queryKey: ["note", noteId ?? null],
    queryFn: () => fetchNote(noteId as string),
    enabled: Boolean(noteId),
  });
}
