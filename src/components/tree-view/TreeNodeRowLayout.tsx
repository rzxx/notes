"use client";

import * as React from "react";
import Link from "next/link";
import type { FlatRow, Note } from "@/lib/stores/tree";

export function TreeNodeRowLayout({
  node,
  row,
  isExpanded,
  isSelected,
  canExpand,
  childCount,
  hasMore,
  isFetching,
  error,
  isStale,
  onToggle,
  onSelect,
  onPrefetch,
}: {
  node: Note;
  row: Extract<FlatRow, { kind: "node" }>;
  isExpanded: boolean;
  isSelected: boolean;
  canExpand: boolean;
  childCount: number;
  hasMore: boolean;
  isFetching: boolean;
  error: unknown;
  isStale: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onPrefetch?: () => void;
}) {
  const expandSymbol = canExpand ? (isExpanded ? "−" : "+") : "·";
  const expandTitle = canExpand ? (isExpanded ? "Collapse" : "Expand") : "No children";

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${isSelected ? "border-stone-300 bg-stone-100" : "border-stone-100 bg-stone-50 hover:border-stone-200 hover:bg-stone-100"}`}
      style={{ paddingLeft: row.depth * 16 + 12 }}
    >
      <button
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-200 text-xs font-semibold text-stone-700 not-disabled:hover:cursor-pointer disabled:opacity-0"
        onClick={onToggle}
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
        disabled={!canExpand}
        title={expandTitle}
        type="button"
      >
        {expandSymbol}
      </button>

      <Link
        href={`/note/${row.id}`}
        onClick={onSelect}
        className="flex flex-1 items-center gap-2 rounded-md px-2 py-1 ring-0 outline-none"
      >
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2 text-sm font-medium text-stone-900">
            <span>{node.title}</span>
            {isFetching ? (
              <span className="text-xs font-normal text-stone-500">Loading…</span>
            ) : null}
          </div>
          <div className="text-[11px] text-stone-500">{node.id}</div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-stone-500">
          <span>
            {childCount > 0 ? `${childCount} children` : canExpand ? "Has children" : "No children"}
          </span>
          {hasMore ? (
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px]">More</span>
          ) : null}
          {isStale ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
              Stale
            </span>
          ) : null}
        </div>
      </Link>

      {error ? <span className="text-[11px] text-red-600">Error</span> : null}
    </div>
  );
}
