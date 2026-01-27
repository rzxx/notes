"use client";

import * as React from "react";
import { useTreeStore } from "@/lib/stores/tree";

export function useDanglingChildrenWarning() {
  const danglingCount = useTreeStore((state) => Object.keys(state.danglingByParent).length);

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

  return danglingCount;
}
