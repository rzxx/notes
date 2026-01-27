"use client";

import * as React from "react";
import { useTreePager } from "@/lib/hooks/treeview/useTreePager";
import { useAutoLoadMore } from "@/lib/hooks/treeview/useAutoLoadMore";

export function useLoadMoreRow(parentId: string | null) {
  const {
    requestNext,
    isFetching,
    error,
    hasNextPage,
    attemptCount,
    failureCount,
    retriesRemaining,
    nextRetryInMs,
    totalRetries,
  } = useTreePager(parentId);

  const handleRequest = React.useCallback(() => {
    if (isFetching) return;
    requestNext();
  }, [isFetching, requestNext]);

  const shouldAutoLoad = hasNextPage !== false && !isFetching && !error;
  const loadMoreRef = useAutoLoadMore({ enabled: shouldAutoLoad, onVisible: handleRequest });

  return {
    handleRequest,
    isFetching,
    error,
    attemptCount,
    failureCount,
    retriesRemaining,
    nextRetryInMs,
    totalRetries,
    shouldAutoLoad,
    loadMoreRef,
  };
}
