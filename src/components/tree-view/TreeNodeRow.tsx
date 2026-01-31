"use client";

import * as React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useTreeStore, type FlatRow, type NodeMeta, type Note } from "@/lib/stores/tree";
import { TreeNodeRowLayout } from "@/components/tree-view/TreeNodeRowLayout";
import { TreeNodeRowActions } from "@/components/tree-view/TreeNodeRowActions";
import { useExpandableRow } from "@/components/tree-view/hooks";
import { useDeleteNote } from "@/lib/hooks/mutations/useDeleteNote";
import type { DropTarget, DropPosition } from "@/components/tree-view/tree-dnd-types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getApproxTitleWidth = (title: string) => {
  const averageCharWidth = 7.5;
  const textWidth = title.length * averageCharWidth;
  return clamp(textWidth, 80, 240) + 24;
};

export function TreeNodeRow({
  row,
  activeId,
  dropTarget,
  parentHighlightId,
  onRowClickCapture,
  isAnyDragging,
}: {
  row: Extract<FlatRow, { kind: "node" }>;
  activeId: string | null;
  dropTarget: DropTarget | null;
  parentHighlightId: string | null;
  onRowClickCapture?: (event: React.MouseEvent) => void;
  isAnyDragging?: boolean;
}) {
  const node = useTreeStore((state) => state.nodes[row.id]);
  const meta = useTreeStore((state) => state.meta[row.id]);
  const toggleExpanded = useTreeStore((state) => state.toggleExpanded);
  const selectedId = useTreeStore((state) => state.selectedId);
  const select = useTreeStore((state) => state.select);
  const deleteNote = useDeleteNote();
  const childCount = meta?.childrenIds.length ?? 0;
  const firstChildId = meta?.childrenIds[0] ?? null;
  const isExpanded = meta?.isExpanded ?? false;
  const hasChildren = Boolean(childCount > 0 || meta?.hasMore || node?.hasChildren);

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
    data: {
      kind: "node",
      depth: row.depth,
      titleWidth: getApproxTitleWidth(node?.title ?? ""),
      parentId: node?.parentId ?? null,
      isExpanded,
      hasChildren,
      firstChildId,
    },
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

  const canExpand = Boolean(node.hasChildren || meta?.hasMore || childCount > 0);
  const isSelected = selectedId === row.id;
  const handleSelect = () => select(row.id);
  const dropIndicator: DropPosition | null =
    dropTarget?.overId === row.id ? dropTarget.position : null;
  const isActiveRow = activeId === row.id;
  const isParentDropTarget = parentHighlightId === row.id;

  const actionsSlot = (
    <TreeNodeRowActions
      node={node}
      onDelete={handleDelete}
      isDragging={isActiveRow || isDragging}
      showDebugInfo={false}
    />
  );

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
        actionsSlot={actionsSlot}
        dropIndicator={dropIndicator}
        isParentDropTarget={isParentDropTarget}
        isDragging={isActiveRow || isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
        setRowRef={setRowRef}
        onRowClickCapture={onRowClickCapture}
        disableLinkPointerEvents={isAnyDragging}
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
      actionsSlot={actionsSlot}
      dropIndicator={dropIndicator}
      isParentDropTarget={isParentDropTarget}
      isDragging={isActiveRow || isDragging}
      dragAttributes={attributes}
      dragListeners={listeners}
      setRowRef={setRowRef}
      onRowClickCapture={onRowClickCapture}
      disableLinkPointerEvents={isAnyDragging}
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
  actionsSlot,
  dropIndicator,
  isParentDropTarget,
  isDragging,
  dragAttributes,
  dragListeners,
  setRowRef,
  onRowClickCapture,
  disableLinkPointerEvents,
}: {
  node: Note;
  row: Extract<FlatRow, { kind: "node" }>;
  meta?: NodeMeta;
  childCount: number;
  isSelected: boolean;
  onSelect: () => void;
  toggleExpanded: (id: string, expanded?: boolean) => void;
  actionsSlot?: React.ReactNode;
  dropIndicator: DropPosition | null;
  isParentDropTarget: boolean;
  isDragging: boolean;
  dragAttributes: ReturnType<typeof useDraggable>["attributes"];
  dragListeners: ReturnType<typeof useDraggable>["listeners"];
  setRowRef: (element: HTMLDivElement | null) => void;
  onRowClickCapture?: (event: React.MouseEvent) => void;
  disableLinkPointerEvents?: boolean;
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
      actionsSlot={actionsSlot}
      dropIndicator={dropIndicator}
      isParentDropTarget={isParentDropTarget}
      isDragging={isDragging}
      dragAttributes={dragAttributes}
      dragListeners={dragListeners}
      setRowRef={setRowRef}
      onRowClickCapture={onRowClickCapture}
      disableLinkPointerEvents={disableLinkPointerEvents}
    />
  );
}
