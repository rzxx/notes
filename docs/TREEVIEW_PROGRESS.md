Tree view client store sketch (mutative + zustand)

What’s implemented

- Normalized state: nodes table, per-node meta (childrenIds, isExpanded, hasMore, nextCursor), rootIds + root pagination, in-flight flags per parent, and danglingByParent bucket for children whose parent is not yet loaded.
- Actions: upsertNodes merges pages into the store (attaches any dangling children when their parent arrives), toggleExpanded flips UI state, moveNode updates parent/ordering, removeNode prunes nodes/refs, beginFetch/finishFetch gate one in-flight fetch per parentId (including root via **root**).
- Derivation: buildFlat walks expanded nodes to produce flat rows with depth plus loadMore sentinels (per parent and root). TreeView now selects stable slices and wraps buildFlat in a useMemo to keep the derived array referentially stable (fixes React 19 hydration complaining about uncached getServerSnapshot and the resulting update loop).
- Note shape now includes `hasChildren`; upsertNodes preserves it so the UI can gate expansion without waiting for a fetch.

How to use with TanStack Query

- One infinite query per parentId, key: ["notes", parentId]. Use beginFetch(parentId) to gate fetch start; first load uses refetch (enabled: false), subsequent loads use fetchNextPage. Since v5 dropped query callbacks, upsertNodes runs inside a useEffect watching query.data?.pages (avoid reruns on unrelated query state), and finishFetch runs when fetchStatus transitions off "fetching". getNextPageParam reads nextCursor. Invalidate locally via queryClient.invalidateQueries(["notes", parentId]).

Important notes

- React 19 hydration calls getServerSnapshot twice; if the selector returns a new array each time, React throws "The result of getServerSnapshot should be cached" and can trigger a max-depth loop. Keep derived flat rows referentially stable (memoized selector or useMemo on stable slices) to prevent this.

Dangling handling

- If children arrive for a parent not in nodes yet, ids go into danglingByParent[parentId]; they do not render. When the parent eventually arrives, upsertNodes attaches the stored children and clears the bucket. Consider logging when danglingByParent is non-empty to catch API ordering issues.

Rendering

- Flat list uses buildFlat(selector) to get rows: kind=node rows carry id/depth; kind=loadMore rows carry parentId/depth. Indent by depth; load-more sentinel triggers fetchNextPage for that parent. Root pagination is represented by a loadMore row with parentId=null.

Notes/considerations

- Ordering is preserved by arrival order; if server adds position, sort before append. appendUnique avoids duplicates but keeps existing ordering.
- Expansion/fetch flow: toggleExpanded, and on expand when childrenIds are empty or hasMore is true, trigger requestNext (beginFetch + refetch/fetchNextPage). Expansion state persists across refetches.
- Optimistic ops: create inserts temp node under parent; delete removes and invalidate parent; move updates parents locally then optionally invalidate both parents.

UI wiring done

- Added useTreePager hook (gated fetch, upsert via effect, finishFetch via fetchStatus) and TreeView component that renders buildFlat rows with expansion toggles and load-more rows. Root auto-fetches once; load-more buttons disabled while fetching. Dangling bucket count surfaces via badge + console.warn to spot API ordering issues.
- Expansion button now derives `canExpand = hasChildren || childrenIds.length > 0 || hasMore`; disabled with a neutral symbol/tooltip when false, preventing fetches on known leaves and giving a reliable affordance before children load.

Notes/gotchas

- Mutation invalidations still target `notes-children` queries; tree pager uses `['notes', parentId]` and stays disabled-by-default, so create/move/delete won’t yet refresh the tree (planned to solve with optimistic upserts or aligned invalidations).
- Bug 2 (tree not updating after create) remains; current changes only address expansion affordance and fetch gating. Keep `canExpand` logic—it will stay accurate after optimistic updates land.
