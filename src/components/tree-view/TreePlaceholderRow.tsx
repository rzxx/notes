"use client";

import * as React from "react";
import type { FlatRow } from "@/lib/stores/tree";

export function TreePlaceholderRow({ row }: { row: Extract<FlatRow, { kind: "placeholder" }> }) {
  return (
    <div
      className="flex items-center rounded-md border border-dashed border-stone-300 bg-stone-100/70 px-2 py-1 text-xs font-medium text-stone-500"
      style={{ paddingLeft: row.depth * 12 + 24 }}
    >
      Drop here
    </div>
  );
}
