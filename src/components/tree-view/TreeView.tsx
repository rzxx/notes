"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTreePager } from "@/lib/hooks/useTreePager";
import { selectFlatRows, useTreeStore } from "@/lib/stores/tree";
import { LoadMoreRow } from "./LoadMoreRow";
import { TreeNodeRow } from "./TreeNodeRow";

export function TreeView() {
  const rows = useTreeStore(selectFlatRows);
  const danglingCount = useTreeStore((state) => Object.keys(state.danglingByParent).length);
  const routeParams = useParams<{ id?: string }>();
  const routeSelectedId = typeof routeParams?.id === "string" ? routeParams.id : undefined;
  const selectedId = useTreeStore((state) => state.selectedId);
  const select = useTreeStore((state) => state.select);
  const clearSelection = useTreeStore((state) => state.clearSelection);

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
    if (routeSelectedId) {
      if (routeSelectedId !== selectedId) select(routeSelectedId);
      return;
    }

    if (selectedId !== null) clearSelection();
  }, [clearSelection, routeSelectedId, select, selectedId]);

  React.useEffect(() => {
    if (!danglingCount) return;
    console.warn(
      "dangling tree children waiting for parents",
      useTreeStore.getState().danglingByParent,
    );
    const timeout = window.setTimeout(() => {
      const dangling = useTreeStore.getState().danglingByParent;
      if (Object.keys(dangling).length) {
        console.warn("dangling tree children still pending", dangling);
      }
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [danglingCount]);

  return (
    <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Tree view
          </h2>
          <p className="text-sm text-stone-600">Zustand + paginated per-parent fetches.</p>
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
          <p className="text-sm text-stone-500">Loading tree…</p>
        ) : null}

        {rows.map((row) => {
          if (row.kind === "node") return <TreeNodeRow key={row.id} row={row} />;
          return <LoadMoreRow key={`${row.parentId ?? "root"}-more`} row={row} />;
        })}
      </div>
    </section>
  );
}
