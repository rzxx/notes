"use client";

import type * as React from "react";
import type { FlatRow } from "@/lib/stores/tree";
import { LoadMoreRow } from "@/components/tree-view/LoadMoreRow";
import { TreeNodeRow } from "@/components/tree-view/TreeNodeRow";
import { TreeAfterDropRow } from "@/components/tree-view/TreeAfterDropRow";
import type { DropTarget } from "@/components/tree-view/tree-dnd-types";

export function TreeRow({
  row,
  activeId,
  dropTarget,
  parentHighlightId,
  onRowClickCapture,
  isAnyDragging,
}: {
  row: FlatRow;
  activeId: string | null;
  dropTarget: DropTarget | null;
  parentHighlightId: string | null;
  onRowClickCapture?: (event: React.MouseEvent) => void;
  isAnyDragging?: boolean;
}) {
  if (row.kind === "node") {
    return (
      <TreeNodeRow
        row={row}
        activeId={activeId}
        dropTarget={dropTarget}
        parentHighlightId={parentHighlightId}
        onRowClickCapture={onRowClickCapture}
        isAnyDragging={isAnyDragging}
      />
    );
  }
  if (row.kind === "afterDrop") {
    return <TreeAfterDropRow row={row} dropTarget={dropTarget} isDragging={Boolean(activeId)} />;
  }
  return <LoadMoreRow row={row} />;
}
