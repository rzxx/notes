"use client";

import * as React from "react";
import { TreeRow } from "@/lib/tree/flattenRows";
import TreeNodeRow from "./TreeNodeRow";
import LoadMoreRow from "./LoadMoreRow";

type TreeListProps = {
  rows: TreeRow[];
  onToggle: (id: string) => void;
  onLoadMore: (parentId: string | null) => void;
  onSelect: (id: string) => void;
  selectedId?: string | null;
};

export function TreeList({ rows, onToggle, onLoadMore, onSelect, selectedId }: TreeListProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-sm">
      <div className="divide-y divide-zinc-100">
        {rows.map((row) => {
          if (row.kind === "node") {
            return (
              <TreeNodeRow
                key={row.id}
                row={row}
                onToggle={onToggle}
                onSelect={onSelect}
                isSelected={selectedId === row.id}
              />
            );
          }

          return (
            <LoadMoreRow
              key={`load-more-${row.parentId ?? "root"}`}
              row={row}
              onLoadMore={onLoadMore}
            />
          );
        })}
      </div>
    </div>
  );
}

export default TreeList;
