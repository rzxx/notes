"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, CircleAlert, Moon, MoveDown } from "lucide-react";
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
  actionsSlot,
  dropIndicator = null,
  isParentDropTarget = false,
  isDragging = false,
  dragAttributes,
  dragListeners,
  setRowRef,
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
  actionsSlot?: React.ReactNode;
  dropIndicator?: "before" | "after" | "inside" | null;
  isParentDropTarget?: boolean;
  isDragging?: boolean;
  dragAttributes?: React.HTMLAttributes<HTMLDivElement>;
  dragListeners?: Record<string, unknown>;
  setRowRef?: (element: HTMLDivElement | null) => void;
}) {
  const expandTitle = canExpand ? (isExpanded ? "Collapse" : "Expand") : "No children";
  const showDropInside = dropIndicator === "inside";
  const showDropBefore = dropIndicator === "before";
  const showDropAfter = dropIndicator === "after";

  return (
    <div
      ref={setRowRef}
      className={`group relative flex items-center gap-1 transition-colors ${isSelected ? "bg-stone-100" : "bg-stone-50 hover:bg-stone-100"} ${showDropInside ? "bg-stone-200/60 ring-1 ring-stone-300" : ""} ${isParentDropTarget ? "bg-stone-200/40 ring-1 ring-stone-200" : ""} ${isDragging ? "opacity-25" : ""}`}
      style={{ paddingLeft: row.depth * 12 }}
      {...dragAttributes}
      {...dragListeners}
    >
      {showDropBefore ? (
        <div
          className="pointer-events-none absolute top-0 right-2 left-0 h-0.5 bg-stone-400"
          style={{ left: row.depth * 12 + 24 }}
        />
      ) : null}
      {showDropAfter ? (
        <div
          className="pointer-events-none absolute right-2 bottom-0 left-0 h-0.5 bg-stone-400"
          style={{ left: row.depth * 12 + 24 }}
        />
      ) : null}
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
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-1 pr-1 text-sm text-stone-500 opacity-75 transition-opacity group-hover:opacity-0">
        <span>{childCount > 0 ? `${childCount}` : canExpand ? "?" : ""}</span>
        {hasMore ? <MoveDown size={16} /> : null}
        {isStale ? <Moon size={16} className="text-amber-400" /> : null}
        {error ? <CircleAlert size={16} className="text-red-600" /> : null}
      </div>

      {actionsSlot}
    </div>
  );
}
