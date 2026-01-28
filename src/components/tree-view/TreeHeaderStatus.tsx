"use client";

import * as React from "react";
import { useDanglingChildrenWarning, useRootLoader } from "@/components/tree-view/hooks";

export function TreeHeaderStatus() {
  const danglingCount = useDanglingChildrenWarning();
  const { requestRoot, isFetchingRoot, rootError } = useRootLoader();

  return (
    <>
      {danglingCount ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          Dangling {danglingCount}
        </span>
      ) : null}

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

      {isFetchingRoot ? <p className="text-sm text-stone-500">Loading tree…</p> : null}
    </>
  );
}
