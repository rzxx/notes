"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Ellipsis,
  Moon,
  MoveDown,
  MoveVertical,
  Trash,
} from "lucide-react";
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
  onDelete,
  dropIndicator = null,
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
  onDelete?: () => void;
  dropIndicator?: "before" | "after" | "inside" | null;
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
      className={`group relative flex items-center gap-1 transition-colors ${isSelected ? "bg-stone-100" : "bg-stone-50 hover:bg-stone-100"} ${showDropInside ? "bg-stone-200/60 ring-1 ring-stone-300" : ""} ${isDragging ? "opacity-40" : ""} cursor-grab active:cursor-grabbing`}
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
            {/* {isFetching ? (
              <span className="text-xs font-normal text-stone-500">Loading…</span>
            ) : null} */}
          </div>
          {/* Can unhide IDs for debug purposes */}
          {/* <div className="line-clamp-1 text-xs text-stone-400">{node.id}</div> */}
          {/* Can unhide ranks for debug purposes */}
          <div className="line-clamp-1 text-xs text-stone-400">{node.rank}</div>
        </div>
      </Link>

      <div className="flex items-center gap-1 pr-1 text-sm text-stone-500 opacity-75 transition-opacity group-hover:opacity-0">
        <span>{childCount > 0 ? `${childCount}` : canExpand ? "?" : ""}</span>
        {hasMore ? <MoveDown size={16} /> : null}
        {isStale ? <Moon size={16} className="text-amber-400" /> : null}
        {error ? <CircleAlert size={16} className="text-red-600" /> : null}
      </div>

      <Menu.Root>
        <Menu.Trigger className="absolute right-0 mr-2 opacity-0 transition-opacity group-hover:opacity-100 hover:cursor-pointer">
          <Ellipsis size={24} strokeWidth={1.5} className="text-stone-500" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={16} side="right">
            <Menu.Popup className="starting-or-ending:opacity-0 starting-or-ending:-translate-x-8 starting-or-ending:scale-y-0 flex gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1 align-baseline shadow-lg transition-[opacity,translate,scale] duration-150 ease-in-out">
              <Menu.Item className="rounded-lg p-2 transition-colors hover:cursor-pointer hover:bg-stone-200">
                <MoveVertical size={24} className="text-stone-700" />
              </Menu.Item>
              <Menu.Item
                onClick={onDelete}
                className="rounded-lg p-2 transition-colors hover:cursor-pointer hover:bg-stone-200"
              >
                <Trash size={24} className="text-red-700" />
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
