"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";

type NotesListItem = {
  id: string;
  parentId: string | null;
  title: string;
  createdAt: string;
  hasChildren: boolean;
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

  const result = await fetchResult<NotesListResponse>(url, {
    method: "GET",
    headers: { "content-type": "application/json" },
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useNotesChildren(parentId: string | null) {
  return useQuery({
    queryKey: ["notes-children", parentId],
    queryFn: () => fetchNotesChildren(parentId),
  });
}
