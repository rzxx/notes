"use client";

import * as React from "react";
import { useTreePager } from "@/lib/hooks/treeview/useTreePager";
import { useAuthToken } from "@/lib/auth/client";

export function useRootLoader() {
  const { requestNext, isFetching, error } = useTreePager(null);
  const { token } = useAuthToken();
  const hasRequestedRoot = React.useRef(false);

  React.useEffect(() => {
    if (!token) {
      hasRequestedRoot.current = false;
      return;
    }
    if (hasRequestedRoot.current) return;
    hasRequestedRoot.current = true;
    requestNext();
  }, [requestNext, token]);

  return {
    requestRoot: requestNext,
    isFetchingRoot: isFetching,
    rootError: error,
  };
}
