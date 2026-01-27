"use client";

import * as React from "react";
import { selectFlatRows, useTreeStore } from "@/lib/stores/tree";
import { TreeRow } from "./TreeRow";
import { useDanglingChildrenWarning, useRootLoader, useSyncRouteSelection } from "./hooks";

export function TreeView() {
  const rows = useTreeStore(selectFlatRows);
  const danglingCount = useDanglingChildrenWarning();
  const { requestRoot, isFetchingRoot, rootError } = useRootLoader();

  useSyncRouteSelection();

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

        {rows.map((row) => (
          <TreeRow
            key={row.kind === "node" ? row.id : `${row.parentId ?? "root"}-more`}
            row={row}
          />
        ))}
      </div>
    </section>
  );
}
