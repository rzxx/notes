"use client";

import type { FlatRow } from "@/lib/stores/tree";
import { LoadMoreRow } from "./LoadMoreRow";
import { TreeNodeRow } from "./TreeNodeRow";

export function TreeRow({ row }: { row: FlatRow }) {
  if (row.kind === "node") return <TreeNodeRow row={row} />;
  return <LoadMoreRow row={row} />;
}
