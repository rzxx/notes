"use client";

import * as React from "react";
import { useTreePager } from "@/lib/hooks/useTreePager";
import { buildFlat, type FlatRow, useTreeStore } from "@/lib/stores/tree";

export function TreeView() {
  const rootIds = useTreeStore((state) => state.rootIds);
  const meta = useTreeStore((state) => state.meta);
  const rootPagination = useTreeStore((state) => state.rootPagination);

  const rows = React.useMemo(
    () => buildFlat({ rootIds, meta, rootPagination }),
    [rootIds, meta, rootPagination],
  );
  const danglingCount = useTreeStore((state) => Object.keys(state.danglingByParent).length);

  const {
    requestNext: requestRoot,
    isFetching: isFetchingRoot,
    error: rootError,
  } = useTreePager(null);
  const hasRequestedRoot = React.useRef(false);

  React.useEffect(() => {
    if (hasRequestedRoot.current) return;
    hasRequestedRoot.current = true;
    requestRoot();
  }, [requestRoot]);

  React.useEffect(() => {
    if (!danglingCount) return;
    console.warn(
      "dangling tree children waiting for parents",
      useTreeStore.getState().danglingByParent,
    );
  }, [danglingCount]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">Tree view</h2>
          <p className="text-sm text-zinc-600">Zustand + paginated per-parent fetches.</p>
        </div>
        {danglingCount ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Dangling {danglingCount}
          </span>
        ) : null}
      </header>

      {rootError ? (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>Failed to load root nodes.</span>
          <button
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white"
            onClick={requestRoot}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="mt-3 space-y-1">
        {rows.length === 0 && isFetchingRoot ? (
          <p className="text-sm text-zinc-500">Loading tree…</p>
        ) : null}

        {rows.map((row) => {
          if (row.kind === "node") return <TreeNodeRow key={row.id} row={row} />;
          return <LoadMoreRow key={`${row.parentId ?? "root"}-more`} row={row} />;
        })}
      </div>
    </section>
  );
}

function TreeNodeRow({ row }: { row: Extract<FlatRow, { kind: "node" }> }) {
  const node = useTreeStore((state) => state.nodes[row.id]);
  const meta = useTreeStore((state) => state.meta[row.id]);
  const toggleExpanded = useTreeStore((state) => state.toggleExpanded);

  const { requestNext, isFetching, error } = useTreePager(row.id);

  if (!node) return null;

  const isExpanded = meta?.isExpanded ?? false;
  const childCount = meta?.childrenIds.length ?? 0;
  const canExpand = Boolean(node.hasChildren || meta?.hasMore || childCount > 0);
  const expandSymbol = canExpand ? (isExpanded ? "−" : "+") : "·";
  const expandTitle = canExpand ? (isExpanded ? "Collapse" : "Expand") : "No children";

  const handleToggle = () => {
    if (!canExpand) return;

    const next = !isExpanded;
    toggleExpanded(row.id, next);

    if (next && (childCount === 0 || meta?.hasMore)) {
      requestNext();
    }
  };

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
      style={{ paddingLeft: row.depth * 16 + 12 }}
    >
      <button
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-xs font-semibold text-zinc-700 not-disabled:hover:cursor-pointer disabled:opacity-0"
        onClick={handleToggle}
        disabled={!canExpand}
        title={expandTitle}
        type="button"
      >
        {expandSymbol}
      </button>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
          <span>{node.title}</span>
          {isFetching ? <span className="text-xs font-normal text-zinc-500">Loading…</span> : null}
        </div>
        <div className="text-[11px] text-zinc-500">{node.id}</div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <span>
          {childCount > 0 ? `${childCount} children` : canExpand ? "Has children" : "No children"}
        </span>
        {meta?.hasMore ? (
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px]">More</span>
        ) : null}
      </div>

      {error ? <span className="text-[11px] text-red-600">Error</span> : null}
    </div>
  );
}

function LoadMoreRow({ row }: { row: Extract<FlatRow, { kind: "loadMore" }> }) {
  const { requestNext, isFetching, error } = useTreePager(row.parentId);

  return (
    <div
      className="flex items-center justify-between rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2"
      style={{ paddingLeft: row.depth * 16 + 12 }}
    >
      <span className="text-sm text-zinc-700">Load more</span>
      <div className="flex items-center gap-2">
        {error ? <span className="text-[11px] text-red-600">Error</span> : null}
        <button
          className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
          onClick={requestNext}
          disabled={isFetching}
          type="button"
        >
          {isFetching ? "Fetching…" : "Fetch next"}
        </button>
      </div>
    </div>
  );
}
