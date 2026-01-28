"use client";

import * as React from "react";
import Link from "next/link";
import type { FlatRow, Note } from "@/lib/stores/tree";
import { ChevronDown, ChevronRight, CircleAlert, Moon, MoveDown } from "lucide-react";

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
  const expandTitle = canExpand ? (isExpanded ? "Collapse" : "Expand") : "No children";

  return (
    <div
      className={`flex items-center gap-1 transition-colors ${isSelected ? "bg-stone-100" : "bg-stone-50 hover:bg-stone-100"}`}
      style={{ paddingLeft: row.depth * 12 }}
    >
      <button
        className="shrink-0 text-stone-500 not-disabled:hover:cursor-pointer disabled:opacity-0"
        onClick={onToggle}
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
        disabled={!canExpand}
        title={expandTitle}
        type="button"
      >
        {isExpanded ? (
          <ChevronDown strokeWidth={1.5} size={24} />
        ) : (
          <ChevronRight strokeWidth={1.5} size={24} />
        )}
      </button>

      <Link href={`/note/${row.id}`} onNavigate={onSelect} className="flex flex-1 items-center">
        <div className="flex flex-1 flex-col">
          <div
            className={`flex items-center gap-2 text-sm text-stone-700 ${isSelected ? "font-semibold" : "font-medium"} ${isFetching ? "animate-pulse" : ""}`}
          >
            <span>{node.title}</span>
            {/* {isFetching ? (
              <span className="text-xs font-normal text-stone-500">Loading…</span>
            ) : null} */}
          </div>
          {/* Can unhide IDs for debug purposes */}
          {/* <div className="line-clamp-1 text-xs text-stone-400">{node.id}</div> */}
        </div>
      </Link>

      <div className="flex items-center gap-1 pr-1 text-sm text-stone-500 opacity-75">
        <span>{childCount > 0 ? `${childCount}` : canExpand ? "?" : ""}</span>
        {hasMore ? <MoveDown size={16} /> : null}
        {isStale ? <Moon size={16} className="text-amber-400" /> : null}
        {error ? <CircleAlert size={16} className="text-red-600" /> : null}
      </div>
    </div>
  );
}
