"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";

export type NotesListItem = {
  id: string;
  parentId: string | null;
  title: string;
  createdAt: string;
  hasChildren: boolean;
};

export type NotesListResponse = {
  ok: true;
  notes: NotesListItem[];
  nextCursor: string | null;
};

type FetchNotesChildrenInput = {
  parentId?: string | null;
  cursor?: string;
  limit?: number;
};

async function fetchNotesChildren(input: FetchNotesChildrenInput = {}) {
  const params = new URLSearchParams();
  const { parentId, cursor, limit } = input;
  if (parentId) params.set("parentId", parentId);
  if (cursor) params.set("cursor", cursor);
  if (typeof limit === "number") params.set("limit", String(limit));

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
    queryFn: () => fetchNotesChildren({ parentId }),
  });
}

export function useNotesChildrenInfinite(
  parentId: string | null,
  options?: { enabled?: boolean; limit?: number },
) {
  return useInfiniteQuery({
    queryKey: ["notes-children", parentId, options?.limit],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchNotesChildren({ parentId, cursor: pageParam ?? undefined, limit: options?.limit }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: options?.enabled ?? true,
  });
}
