import * as React from "react";

type TreeListItemProps = {
  title: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isLoading?: boolean;
  isSelected?: boolean;
};

export function TreeListItem({
  title,
  depth,
  hasChildren,
  isExpanded,
  isLoading,
  isSelected,
}: TreeListItemProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${
        isSelected ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"
      }`}
      style={{ paddingLeft: depth * 16 + 12 }}
    >
      <span className="flex h-4 w-4 items-center justify-center text-xs text-zinc-500">
        {hasChildren ? (isExpanded ? "▾" : "▸") : "•"}
      </span>
      <span className="truncate text-left font-medium">{title}</span>
      {isLoading ? <span className="ml-auto text-[11px] text-zinc-500">Loading…</span> : null}
    </div>
  );
}

export default TreeListItem;
