"use client";

import type { FlatRow } from "@/lib/stores/tree";
import { useLoadMoreRow } from "./hooks";

export function LoadMoreRow({ row }: { row: Extract<FlatRow, { kind: "loadMore" }> }) {
  const {
    handleRequest,
    isFetching,
    error,
    attemptCount,
    failureCount,
    retriesRemaining,
    nextRetryInMs,
    totalRetries,
    shouldAutoLoad,
    loadMoreRef,
  } = useLoadMoreRow(row.parentId ?? null);

  return (
    <div
      className="flex items-center justify-between rounded-md border border-dashed border-stone-200 bg-stone-50 px-3 py-2"
      ref={loadMoreRef}
      style={{ paddingLeft: row.depth * 16 + 12 }}
    >
      <div className="flex flex-col">
        <span className="text-sm text-stone-700">Load more</span>
        <span className="text-[11px] text-stone-500">
          {shouldAutoLoad
            ? "Auto-fetches when visible"
            : error
              ? "Fetch failed — retry"
              : "Waiting"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {attemptCount > 0 ? (
          <span className="text-[11px] text-stone-500">Attempts {attemptCount}</span>
        ) : null}
        {failureCount > 0 ? (
          <span className="text-[11px] text-amber-700">
            Retries left {retriesRemaining}/{totalRetries}
          </span>
        ) : null}
        {nextRetryInMs !== null && nextRetryInMs > 0 ? (
          <span className="text-[11px] text-amber-600">
            Retrying in {Math.ceil(nextRetryInMs / 1000)}s
          </span>
        ) : null}
        {error ? <span className="text-[11px] text-red-600">Error</span> : null}
        <button
          className="rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
          onClick={handleRequest}
          disabled={isFetching}
          type="button"
        >
          {isFetching ? "Fetching…" : "Fetch next"}
        </button>
      </div>
    </div>
  );
}
