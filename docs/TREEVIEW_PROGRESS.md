Tree view client store sketch (mutative + zustand)

What’s implemented

- Normalized state: nodes table, per-node meta (childrenIds, isExpanded, hasMore, nextCursor), rootIds + root pagination, and danglingByParent bucket for children whose parent is not yet loaded. Removed manual in-flight flags; rely on TanStack Query fetch state per parent key.
- Actions: upsertNodes merges pages into the store (attaches any dangling children when their parent arrives), toggleExpanded flips UI state, moveNode updates parent/ordering, removeNode prunes nodes/refs, restoreNode supports rollbacks.
- Derivation: buildFlat walks expanded nodes to produce flat rows with depth plus loadMore sentinels (per parent and root). TreeView uses memoized selector `selectFlatRows` for referential stability (React 19 hydration-safe).
- Note shape includes `hasChildren` and `createdAt`; upsertNodes preserves both so the UI can gate expansion without waiting for a fetch and so ordering can be derived client-side.

How to use with TanStack Query

- One infinite query per parentId, key: ["notes", parentId]. We rely on Query’s fetch state instead of a manual gate; `requestNext` bails if fetchStatus/isFetchingNextPage is true. First load uses refetch (enabled: false), subsequent loads use fetchNextPage. upsertNodes runs inside an effect watching query.data?.pages (avoids reruns on unrelated query state). getNextPageParam reads nextCursor. Invalidate locally via queryClient.invalidateQueries(["notes", parentId]).

Important notes

- React 19 hydration calls getServerSnapshot twice; if the selector returns a new array each time, React throws "The result of getServerSnapshot should be cached" and can trigger a max-depth loop. Keep derived flat rows referentially stable (memoized selector or useMemo on stable slices) to prevent this.

Dangling handling

- If children arrive for a parent not in nodes yet, ids go into danglingByParent[parentId]; they do not render. When the parent eventually arrives, upsertNodes attaches the stored children and clears the bucket. Consider logging when danglingByParent is non-empty to catch API ordering issues.

Rendering

- Flat list uses buildFlat(selector) to get rows: kind=node rows carry id/depth; kind=loadMore rows carry parentId/depth. Indent by depth; load-more sentinel triggers fetchNextPage for that parent. Root pagination is represented by a loadMore row with parentId=null.

Notes/considerations

- Ordering now uses `createdAt` desc with `id` tiebreak. mergeSortedIds keeps `rootIds` and per-parent `childrenIds` sorted in the store; upsert detaches a node from any prior parent when its parentId changes (avoids duplicate keys after moves/invalidation). If server ever returns position, swap comparator.
- Expansion/fetch flow: toggleExpanded, and on expand when childrenIds are empty or hasMore is true, trigger requestNext (beginFetch + refetch/fetchNextPage). Expansion state persists across refetches.
- Optimistic ops: create inserts temp node under parent; delete removes and invalidate parent; move updates parents locally then optionally invalidate both parents.

UI wiring done

- useTreePager now uses TanStack fetch state (no manual in-flight map), `fetchResultWithTimeout` (shared timeout) to avoid stuck cold-start fetches, and `useRetryTelemetry` to expose retries remaining and retry countdown derived from shared query config. TreeView renders those counters on load-more rows.
- Load-more auto-fetch uses shared `useAutoLoadMore` (IntersectionObserver). Buttons remain for manual retry; auto-fetch only when not already fetching. Expansion button still derives `canExpand = hasChildren || childrenIds.length > 0 || hasMore`.

Notes/gotchas

- Mutations are fully optimistic via store actions: create injects a temp node and replaces it on success; delete removes immediately and restores from snapshot on error; move updates parents immediately and rolls back on error; rename writes optimistic title.
- Added store `restoreNode` to reattach deleted nodes (with optional meta and index) for clean rollback.
- Query keys/invalidation aligned to `['notes', parentId]`; we cancel/restore around optimistic steps instead of refetching.
- Bug 2 (tree not updating after create) should be resolved by the optimistic upsert/invalidation alignment; keep an eye on server ordering vs. optimistic position.
- `fetchResultWithTimeout` uses shared timeout; retry telemetry reflects shared retry count/delay. A timed-out fetch surfaces as error + retry (no stuck loading). Empty page with hasMore logs a warning; dangling buckets warn immediately and re-warn if still present after a short delay.

Implementation updates / gotchas

- Optimistic create stamps `createdAt` (server timestamp on success) so new items sort correctly.
- move/restore ignore the optional index and rely on sorted merge to keep order consistent.
- upsert detaches nodes from their previous parent/root when parentId changes, preventing duplicate IDs from appearing under both parents after fetches.
- InfiniteQuery `getNextPageParam` now guards `lastPage` to avoid undefined access during initial optimistic render.
