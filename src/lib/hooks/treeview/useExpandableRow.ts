"use client";

import * as React from "react";
import { useTreePager } from "@/lib/hooks/treeview/useTreePager";
import { useNotesStaleness } from "@/lib/hooks/treeview/useNotesStaleness";
import { usePrefetchNotesPage } from "@/lib/hooks/treeview/usePrefetchNotesPage";
import type { NodeMeta } from "@/lib/stores/tree";

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
