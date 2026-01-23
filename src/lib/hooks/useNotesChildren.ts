"use client";

import { useQuery } from "@tanstack/react-query";

type NotesListItem = {
  id: string;
  parentId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type NotesListResponse = {
  ok: true;
  notes: NotesListItem[];
  nextCursor: string | null;
};

async function fetchNotesChildren(parentId?: string | null) {
  const params = new URLSearchParams();
  if (parentId) params.set("parentId", parentId);
  const url = params.toString() ? `/api/notes?${params.toString()}` : "/api/notes";

  const response = await fetch(url, {
    method: "GET",
    headers: { "content-type": "application/json" },
  });

  const payload = (await response.json()) as NotesListResponse;
  if (!response.ok) {
    throw new Error(payload ? JSON.stringify(payload) : "Request failed");
  }

  return payload;
}

export function useNotesChildren(parentId?: string | null) {
  return useQuery({
    queryKey: ["notes-children", parentId ?? null],
    queryFn: () => fetchNotesChildren(parentId),
  });
}
