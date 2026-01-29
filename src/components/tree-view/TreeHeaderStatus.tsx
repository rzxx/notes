"use client";

import * as React from "react";
import { useDanglingChildrenWarning, useRootLoader } from "@/components/tree-view/hooks";
import { LoaderCircle } from "lucide-react";

export function TreeHeaderStatus() {
  const danglingCount = useDanglingChildrenWarning();
  const { requestRoot, isFetchingRoot, rootError } = useRootLoader();

  return (
    <div className="flex gap-2 opacity-75">
      {danglingCount ? (
        <span className="text-xs font-medium text-amber-700">Dangling {danglingCount}</span>
      ) : null}

      {rootError ? (
        <div className="flex h-full items-center gap-1 text-sm text-red-700">
          <span>Failed to load notes.</span>
          <button
            className="cursor-pointer rounded-md bg-red-700 px-3 py-0.5 text-xs font-semibold text-white"
            onClick={requestRoot}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      <LoaderCircle
        size={16}
        strokeWidth={1.5}
        className={`animate-spin text-stone-500 transition-opacity duration-250 ease-out ${
          isFetchingRoot
            ? "opacity-100 [animation-play-state:running]"
            : "opacity-0 [animation-play-state:paused]"
        }`}
      />
    </div>
  );
}
