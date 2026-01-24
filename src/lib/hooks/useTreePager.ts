"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { useTreeStore } from "@/lib/stores/tree";

type NotesPage = {
  ok: true;
  notes: {
    id: string;
    parentId: string | null;
    title: string;
    createdAt: string;
    hasChildren: boolean;
  }[];
  nextCursor: string | null;
};

async function fetchNotesPage(parentId: string | null, cursor: string | null) {
  const params = new URLSearchParams();
  if (parentId) params.set("parentId", parentId);
  if (cursor) params.set("cursor", cursor);

  const url = params.toString() ? `/api/notes?${params.toString()}` : "/api/notes";

  const result = await fetchResult<NotesPage>(url, {
    method: "GET",
    headers: { "content-type": "application/json" },
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useTreePager(parentId: string | null) {
  const { upsertNodes, beginFetch, finishFetch } = useTreeStore.getState();

  const query = useInfiniteQuery({
    queryKey: ["notes", parentId],
    queryFn: ({ pageParam }) => fetchNotesPage(parentId, pageParam ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: false,
    refetchOnMount: false,
  });

  const requestNext = React.useCallback(() => {
    if (!beginFetch(parentId)) return;

    const isFirstLoad = !query.data?.pages.length;
    const trigger = isFirstLoad ? query.refetch : query.fetchNextPage;

    void trigger({ throwOnError: false });
  }, [beginFetch, parentId, query.data?.pages.length, query.fetchNextPage, query.refetch]);

  const isFetching = query.fetchStatus === "fetching" || query.isFetchingNextPage;

  React.useEffect(() => {
    if (!query.data) return;

    query.data.pages.forEach((page) => {
      upsertNodes(parentId, page.notes, {
        hasMore: Boolean(page.nextCursor),
        nextCursor: page.nextCursor,
      });
    });
  }, [parentId, query.data, upsertNodes]);

  const previousFetchStatus = React.useRef(query.fetchStatus);

  React.useEffect(() => {
    if (previousFetchStatus.current === "fetching" && query.fetchStatus !== "fetching") {
      finishFetch(parentId);
    }
    previousFetchStatus.current = query.fetchStatus;
  }, [finishFetch, parentId, query.fetchStatus]);

  return {
    requestNext,
    isFetching,
    error: query.error,
    hasNextPage: query.hasNextPage,
  };
}
