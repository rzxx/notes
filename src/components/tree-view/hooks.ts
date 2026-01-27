"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useAutoLoadMore } from "@/lib/hooks/useAutoLoadMore";
import { useNotesStaleness } from "@/lib/hooks/useNotesStaleness";
import { usePrefetchNotesPage } from "@/lib/hooks/usePrefetchNotesPage";
import { useTreePager } from "@/lib/hooks/useTreePager";
import { useTreeStore, type NodeMeta } from "@/lib/stores/tree";

export function useRootLoader() {
  const { requestNext, isFetching, error } = useTreePager(null);
  const hasRequestedRoot = React.useRef(false);

  React.useEffect(() => {
    if (hasRequestedRoot.current) return;
    hasRequestedRoot.current = true;
    requestNext();
  }, [requestNext]);

  return {
    requestRoot: requestNext,
    isFetchingRoot: isFetching,
    rootError: error,
  };
}

export function useSyncRouteSelection() {
  const routeParams = useParams<{ id?: string }>();
  const routeSelectedId = typeof routeParams?.id === "string" ? routeParams.id : undefined;
  const selectedId = useTreeStore((state) => state.selectedId);
  const select = useTreeStore((state) => state.select);
  const clearSelection = useTreeStore((state) => state.clearSelection);

  React.useEffect(() => {
    if (routeSelectedId) {
      if (routeSelectedId !== selectedId) select(routeSelectedId);
      return;
    }

    if (selectedId !== null) clearSelection();
  }, [clearSelection, routeSelectedId, select, selectedId]);
}

export function useDanglingChildrenWarning() {
  const danglingCount = useTreeStore((state) => Object.keys(state.danglingByParent).length);

  React.useEffect(() => {
    if (!danglingCount) return;
    console.warn(
      "dangling tree children waiting for parents",
      useTreeStore.getState().danglingByParent,
    );
    const timeout = window.setTimeout(() => {
      const dangling = useTreeStore.getState().danglingByParent;
      if (Object.keys(dangling).length) {
        console.warn("dangling tree children still pending", dangling);
      }
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [danglingCount]);

  return danglingCount;
}

export function useExpandableRow({
  rowId,
  meta,
  childCount,
  toggleExpanded,
}: {
  rowId: string;
  meta?: NodeMeta;
  childCount: number;
  toggleExpanded: (id: string, expanded?: boolean) => void;
}) {
  const isEnabled = meta?.isExpanded ?? false;
  const {
    requestNext,
    isFetching,
    error,
    isStale: queryIsStale,
  } = useTreePager(rowId, {
    enabled: isEnabled,
  });
  const isExpanded = meta?.isExpanded ?? false;
  const isStale = useNotesStaleness(rowId, isEnabled, queryIsStale);
  const prefetch = usePrefetchNotesPage(rowId);

  const handleToggle = React.useCallback(() => {
    const next = !isExpanded;
    toggleExpanded(rowId, next);

    if (next && (childCount === 0 || meta?.hasMore)) {
      requestNext();
    }
  }, [childCount, isExpanded, meta?.hasMore, requestNext, rowId, toggleExpanded]);

  return {
    isExpanded,
    isFetching,
    error,
    isStale,
    hasMore: meta?.hasMore ?? false,
    onToggle: handleToggle,
    onPrefetch: prefetch,
  };
}

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
