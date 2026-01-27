"use client";

import * as React from "react";
import { useTreeStore, type FlatRow, type NodeMeta, type Note } from "@/lib/stores/tree";
import { TreeNodeRowLayout } from "./TreeNodeRowLayout";
import { useExpandableRow } from "./hooks";

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
      row={row}
      meta={meta}
      childCount={childCount}
      isSelected={isSelected}
      onSelect={handleSelect}
      toggleExpanded={toggleExpanded}
      node={node}
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
  const expandable = useExpandableRow({
    rowId: row.id,
    meta,
    childCount,
    toggleExpanded,
  });

  return (
    <TreeNodeRowLayout
      node={node}
      row={row}
      isExpanded={expandable.isExpanded}
      isSelected={isSelected}
      canExpand
      childCount={childCount}
      hasMore={expandable.hasMore}
      isFetching={expandable.isFetching}
      error={expandable.error}
      isStale={expandable.isStale}
      onToggle={expandable.onToggle}
      onSelect={onSelect}
      onPrefetch={expandable.onPrefetch}
    />
  );
}
