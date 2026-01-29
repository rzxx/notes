"use client";

import * as React from "react";
import type { NodeMeta, Note } from "@/lib/stores/tree";

export function TreeDragOverlayRow({
  node,
  meta,
  depth,
}: {
  node: Note;
  meta?: NodeMeta;
  depth: number;
}) {
  const childCount = meta?.childrenIds.length ?? 0;
  const hasUnknownChildren = childCount === 0 && (node.hasChildren || meta?.hasMore);

  return (
    <div
      className="pointer-events-none flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50/95 px-2 py-1 shadow-md"
      style={{ paddingLeft: depth * 12 + 8 }}
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-stone-700">{node.title}</span>
        {/* <span className="text-xs text-stone-400">{node.rank}</span> */}
      </div>
      <div className="ml-auto flex items-center gap-1 text-xs text-stone-500">
        {childCount > 0 ? <span>{childCount}</span> : null}
        {hasUnknownChildren ? <span>has more</span> : null}
      </div>
    </div>
  );
}
