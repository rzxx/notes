"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useTreeStore, type FlatRow, type NodeMeta, type Note } from "@/lib/stores/tree";
import { TreeNodeRowLayout } from "@/components/tree-view/TreeNodeRowLayout";
import { useExpandableRow } from "@/components/tree-view/hooks";
import { useDeleteNote } from "@/lib/hooks/mutations/useDeleteNote";
import type { DropTarget, DropPosition } from "@/components/tree-view/tree-dnd-types";

export function TreeNodeRow({
  row,
  activeId,
  dropTarget,
}: {
  row: Extract<FlatRow, { kind: "node" }>;
  activeId: string | null;
  dropTarget: DropTarget | null;
}) {
  const node = useTreeStore((state) => state.nodes[row.id]);
  const meta = useTreeStore((state) => state.meta[row.id]);
  const toggleExpanded = useTreeStore((state) => state.toggleExpanded);
  const selectedId = useTreeStore((state) => state.selectedId);
  const select = useTreeStore((state) => state.select);
  const deleteNote = useDeleteNote();

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: row.id,
    data: { kind: "node" },
  });

  const { setNodeRef: setDropRef } = useDroppable({
    id: row.id,
    data: { kind: "node" },
  });

  const setRowRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      setDragRef(element);
      setDropRef(element);
    },
    [setDragRef, setDropRef],
  );

  const handleDelete = () => {
    const parentId = node.parentId ?? null;
    deleteNote.mutate({ noteId: row.id, parentId });
  };

  if (!node) return null;

  const childCount = meta?.childrenIds.length ?? 0;
  const canExpand = Boolean(node.hasChildren || meta?.hasMore || childCount > 0);
  const isSelected = selectedId === row.id;
  const handleSelect = () => select(row.id);
  const dropIndicator: DropPosition | null =
    dropTarget?.overId === row.id ? dropTarget.position : null;
  const isActiveRow = activeId === row.id;

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
        onDelete={handleDelete}
        dropIndicator={dropIndicator}
        isDragging={isActiveRow || isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
        setRowRef={setRowRef}
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
      onDelete={handleDelete}
      dropIndicator={dropIndicator}
      isDragging={isActiveRow || isDragging}
      dragAttributes={attributes}
      dragListeners={listeners}
      setRowRef={setRowRef}
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
  onDelete,
  dropIndicator,
  isDragging,
  dragAttributes,
  dragListeners,
  setRowRef,
}: {
  node: Note;
  row: Extract<FlatRow, { kind: "node" }>;
  meta?: NodeMeta;
  childCount: number;
  isSelected: boolean;
  onSelect: () => void;
  toggleExpanded: (id: string, expanded?: boolean) => void;
  onDelete?: () => void;
  dropIndicator: DropPosition | null;
  isDragging: boolean;
  dragAttributes: ReturnType<typeof useDraggable>["attributes"];
  dragListeners: ReturnType<typeof useDraggable>["listeners"];
  setRowRef: (element: HTMLDivElement | null) => void;
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
      onDelete={onDelete}
      dropIndicator={dropIndicator}
      isDragging={isDragging}
      dragAttributes={dragAttributes}
      dragListeners={dragListeners}
      setRowRef={setRowRef}
    />
  );
}
