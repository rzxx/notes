"use client";

import * as React from "react";
import { useTreePager } from "@/lib/hooks/treeview/useTreePager";

export function useRootLoader() {
  const { requestNext, isFetching, error } = useTreePager(null);
  const hasRequestedRoot = React.useRef(false);

  React.useEffect(() => {
    if (hasRequestedRoot.current) return;
    hasRequestedRoot.current = true;
    requestNext();
  }, [requestNext]);

  return {
    requestRoot: requestNext,
    isFetchingRoot: isFetching,
    rootError: error,
  };
}
