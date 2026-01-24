"use client";

import * as React from "react";
import { TreeNodeRow as TreeNodeRowType } from "@/lib/tree/flattenRows";
import TreeListItem from "./TreeListItem";

type TreeNodeRowProps = {
  row: TreeNodeRowType;
  onToggle: (id: string) => void;
  isSelected?: boolean;
};

export function TreeNodeRow({ row, onToggle, isSelected }: TreeNodeRowProps) {
  const handleToggle = React.useCallback(() => {
    if (row.hasChildren) onToggle(row.id);
  }, [onToggle, row.hasChildren, row.id]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
      aria-expanded={row.hasChildren ? row.isExpanded : undefined}
    >
      <TreeListItem
        title={row.title}
        depth={row.depth}
        hasChildren={row.hasChildren}
        isExpanded={row.isExpanded}
        isLoading={row.isLoading}
        isSelected={isSelected}
      />
    </button>
  );
}

export default TreeNodeRow;
