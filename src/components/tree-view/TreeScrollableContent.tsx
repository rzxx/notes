"use client";

import * as React from "react";
import { selectFlatRows, useTreeStore } from "@/lib/stores/tree";
import { TreeRow } from "@/components/tree-view/TreeRow";
import { useSyncRouteSelection } from "@/components/tree-view/hooks";

export function TreeScrollableContent() {
  const rows = useTreeStore(selectFlatRows);

  useSyncRouteSelection();

  return (
    <div
      className={`space-y-1 transition-[opacity,translate,scale] duration-300 ${rows.length > 0 ? "opacity-100" : "-translate-x-2 scale-95 opacity-0"}`}
    >
      {rows.map((row) => (
        <TreeRow key={row.kind === "node" ? row.id : `${row.parentId ?? "root"}-more`} row={row} />
      ))}
    </div>
  );
}
