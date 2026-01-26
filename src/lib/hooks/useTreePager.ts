"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchResultWithTimeout } from "@/lib/api";
import { useTreeStore } from "@/lib/stores/tree";
import { useRetryTelemetry } from "@/lib/hooks/useRetryTelemetry";
import { FETCH_TIMEOUT_MS } from "@/lib/query-config";

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

  const result = await fetchResultWithTimeout<NotesPage>(
    url,
    {
      method: "GET",
      headers: { "content-type": "application/json" },
    },
    FETCH_TIMEOUT_MS,
  );

  if (!result.ok) throw result.error;
  return result.value;
}

export function useTreePager(parentId: string | null) {
  const { upsertNodes } = useTreeStore.getState();

  const [attemptCount, setAttemptCount] = React.useState(0);

  React.useEffect(() => {
    setAttemptCount(0);
  }, [parentId]);

  const query = useInfiniteQuery({
    queryKey: ["notes", parentId],
    queryFn: ({ pageParam }) => fetchNotesPage(parentId, pageParam ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled: false,
    refetchOnMount: false,
  });

  const requestNext = React.useCallback(() => {
    if (query.fetchStatus === "fetching" || query.isFetchingNextPage) return;

    setAttemptCount((count) => count + 1);

    const isFirstLoad = !query.data?.pages.length;
    const trigger = isFirstLoad ? query.refetch : query.fetchNextPage;

    void trigger({ throwOnError: false });
  }, [
    parentId,
    query.data?.pages.length,
    query.fetchNextPage,
    query.fetchStatus,
    query.isFetchingNextPage,
    query.refetch,
  ]);

  const isFetching = query.fetchStatus === "fetching" || query.isFetchingNextPage;

  const retryTelemetry = useRetryTelemetry({
    fetchStatus: query.fetchStatus,
    failureCount: query.failureCount ?? 0,
  });

  const warnedEmptyHasMore = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (!query.data?.pages) return;

    query.data.pages.forEach((page) => {
      if (
        page.notes.length === 0 &&
        page.nextCursor &&
        !warnedEmptyHasMore.current.has(parentId ?? "root")
      ) {
        warnedEmptyHasMore.current.add(parentId ?? "root");
        console.warn("Tree pager received empty page with hasMore=true", { parentId, page });
      }

      upsertNodes(parentId, page.notes, {
        hasMore: Boolean(page.nextCursor),
        nextCursor: page.nextCursor,
      });
    });
  }, [parentId, query.data?.pages, upsertNodes]);

  return {
    requestNext,
    isFetching,
    error: query.error,
    hasNextPage: query.hasNextPage,
    attemptCount,
    failureCount: retryTelemetry.failureCount,
    retriesRemaining: retryTelemetry.retriesRemaining,
    nextRetryInMs: retryTelemetry.nextRetryInMs,
    totalRetries: retryTelemetry.totalRetries,
  };
}
