"use client";

import type { FlatRow } from "@/lib/stores/tree";
import { LoadMoreRow } from "@/components/tree-view/LoadMoreRow";
import { TreeNodeRow } from "@/components/tree-view/TreeNodeRow";
import type { DropTarget } from "@/components/tree-view/tree-dnd-types";

export function TreeRow({
  row,
  activeId,
  dropTarget,
  parentHighlightId,
}: {
  row: FlatRow;
  activeId: string | null;
  dropTarget: DropTarget | null;
  parentHighlightId: string | null;
}) {
  if (row.kind === "node") {
    return (
      <TreeNodeRow
        row={row}
        activeId={activeId}
        dropTarget={dropTarget}
        parentHighlightId={parentHighlightId}
      />
    );
  }
  return <LoadMoreRow row={row} />;
}
