"use client";

import * as React from "react";
import { selectFlatRows, useTreeStore } from "@/lib/stores/tree";
import { TreeRow } from "@/components/tree-view/TreeRow";
import { useSyncRouteSelection } from "@/components/tree-view/hooks";

export function TreeScrollableContent() {
  const rows = useTreeStore(selectFlatRows);

  useSyncRouteSelection();

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <TreeRow key={row.kind === "node" ? row.id : `${row.parentId ?? "root"}-more`} row={row} />
      ))}
    </div>
  );
}
