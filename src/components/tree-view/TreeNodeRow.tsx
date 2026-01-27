"use client";

import * as React from "react";
import { useNotesStaleness } from "@/lib/hooks/useNotesStaleness";
import { usePrefetchNotesPage } from "@/lib/hooks/usePrefetchNotesPage";
import { useTreePager } from "@/lib/hooks/useTreePager";
import { useTreeStore, type FlatRow, type NodeMeta, type Note } from "@/lib/stores/tree";
import { TreeNodeRowLayout } from "./TreeNodeRowLayout";

export function TreeNodeRow({ row }: { row: Extract<FlatRow, { kind: "node" }> }) {
  const node = useTreeStore((state) => state.nodes[row.id]);
  const meta = useTreeStore((state) => state.meta[row.id]);
  const toggleExpanded = useTreeStore((state) => state.toggleExpanded);
  const selectedId = useTreeStore((state) => state.selectedId);
  const select = useTreeStore((state) => state.select);

  if (!node) return null;

  const childCount = meta?.childrenIds.length ?? 0;
  const canExpand = Boolean(node.hasChildren || meta?.hasMore || childCount > 0);
  const isSelected = selectedId === row.id;
  const handleSelect = () => select(row.id);

  if (!canExpand) {
    return (
      <TreeNodeRowLayout
        node={node}
        row={row}
        isSelected={isSelected}
        isExpanded={false}
        canExpand={false}
        childCount={childCount}
        hasMore={meta?.hasMore ?? false}
        isFetching={false}
        error={null}
        isStale={false}
        onToggle={() => {}}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <ExpandableTreeNodeRow
      node={node}
      row={row}
      meta={meta}
      childCount={childCount}
      isSelected={isSelected}
      onSelect={handleSelect}
      toggleExpanded={toggleExpanded}
    />
  );
}

function ExpandableTreeNodeRow({
  node,
  row,
  meta,
  childCount,
  isSelected,
  onSelect,
  toggleExpanded,
}: {
  node: Note;
  row: Extract<FlatRow, { kind: "node" }>;
  meta?: NodeMeta;
  childCount: number;
  isSelected: boolean;
  onSelect: () => void;
  toggleExpanded: (id: string, expanded?: boolean) => void;
}) {
  const isEnabled = meta?.isExpanded ?? false;
  const {
    requestNext,
    isFetching,
    error,
    isStale: queryIsStale,
  } = useTreePager(row.id, {
    enabled: isEnabled,
  });
  const isExpanded = meta?.isExpanded ?? false;
  const isStale = useNotesStaleness(row.id, isEnabled, queryIsStale);
  const prefetch = usePrefetchNotesPage(row.id);

  const handleToggle = () => {
    const next = !isExpanded;
    toggleExpanded(row.id, next);

    if (next && (childCount === 0 || meta?.hasMore)) {
      requestNext();
    }
  };

  return (
    <TreeNodeRowLayout
      node={node}
      row={row}
      isExpanded={isExpanded}
      isSelected={isSelected}
      canExpand
      childCount={childCount}
      hasMore={meta?.hasMore ?? false}
      isFetching={isFetching}
      error={error}
      isStale={isStale}
      onToggle={handleToggle}
      onSelect={onSelect}
      onPrefetch={prefetch}
    />
  );
}
