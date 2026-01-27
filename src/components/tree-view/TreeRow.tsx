"use client";

import type { FlatRow } from "@/lib/stores/tree";
import { LoadMoreRow } from "@/components/tree-view/LoadMoreRow";
import { TreeNodeRow } from "@/components/tree-view/TreeNodeRow";

export function TreeRow({ row }: { row: FlatRow }) {
  if (row.kind === "node") return <TreeNodeRow row={row} />;
  return <LoadMoreRow row={row} />;
}
