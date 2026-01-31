"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { FlatRow } from "@/lib/stores/tree";
import type { DropTarget } from "@/components/tree-view/tree-dnd-types";

export function TreeAfterDropRow({
  row,
  dropTarget,
  isDragging,
}: {
  row: Extract<FlatRow, { kind: "afterDrop" }>;
  dropTarget: DropTarget | null;
  isDragging: boolean;
}) {
  const dropId = React.useMemo(() => `after:${row.nodeId}`, [row.nodeId]);
  const { setNodeRef } = useDroppable({
    id: dropId,
    data: {
      kind: "after",
      nodeId: row.nodeId,
      parentId: row.parentId ?? null,
      depth: row.depth,
    },
  });

  const showDropAfter = dropTarget?.overId === dropId;

  return (
    <div ref={setNodeRef} className={isDragging ? "relative h-2" : "hidden"}>
      {showDropAfter ? (
        <div
          className="pointer-events-none absolute top-1/2 right-2 left-0 h-0.5 -translate-y-1/2 bg-stone-400"
          style={{ left: row.depth * 12 + 24 }}
        />
      ) : null}
    </div>
  );
}
