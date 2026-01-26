"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const CHECK_INTERVAL_MS = 5_000;

export function useNotesStaleness(
  parentId: string | null,
  enabled: boolean,
  queryIsStale: boolean,
) {
  const queryClient = useQueryClient();

  const subscribe = useMemo(() => {
    return (onStoreChange: () => void) => {
      const notify = () => setTimeout(onStoreChange, 0);
      const cacheUnsub = queryClient.getQueryCache().subscribe(notify);
      const interval = window.setInterval(notify, CHECK_INTERVAL_MS);
      return () => {
        cacheUnsub();
        window.clearInterval(interval);
      };
    };
  }, [queryClient]);

  const getSnapshot = useMemo(() => {
    return () => {
      if (enabled) return queryIsStale;

      const queryKey = queryKeys.notes.list(parentId);
      const state = queryClient.getQueryState(queryKey);
      if (!state?.dataUpdatedAt) return false;

      const metaStale = (state as { meta?: { staleTime?: number } }).meta?.staleTime;
      const defaultStale = queryClient.getDefaultOptions().queries?.staleTime;
      const staleTime =
        typeof metaStale === "number"
          ? metaStale
          : typeof defaultStale === "number"
            ? defaultStale
            : 0;

      if (state.isInvalidated) return true;
      if (staleTime === Infinity) return false;

      return Date.now() - state.dataUpdatedAt > staleTime;
    };
  }, [enabled, parentId, queryClient, queryIsStale]);

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
