"use client";

import * as React from "react";
import { LoadMoreRow as LoadMoreRowType } from "@/lib/tree/flattenRows";

type LoadMoreRowProps = {
  row: LoadMoreRowType;
  onLoadMore: (parentId: string | null) => void;
};

export function LoadMoreRow({ row, onLoadMore }: LoadMoreRowProps) {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!buttonRef.current || row.isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore(row.parentId);
        }
      },
      { rootMargin: "160px" },
    );

    observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, [onLoadMore, row.isLoading, row.parentId]);

  const handleClick = () => {
    if (!row.isLoading && row.hasMore) {
      onLoadMore(row.parentId);
    }
  };

  return (
    <div className="bg-zinc-50" style={{ paddingLeft: row.depth * 16 + 12 }}>
      <button
        ref={buttonRef}
        type="button"
        className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-medium text-zinc-600 hover:text-zinc-800"
        onClick={handleClick}
        disabled={!row.hasMore || row.isLoading}
      >
        <span className="h-3 w-3">
          {row.isLoading ? (
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border border-zinc-300 border-t-zinc-500"
              aria-hidden
            />
          ) : (
            ""
          )}
        </span>
        <span>{row.isLoading ? "Loading more..." : "Load more"}</span>
      </button>
    </div>
  );
}

export default LoadMoreRow;
