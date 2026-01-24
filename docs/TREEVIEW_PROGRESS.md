Tree view client store sketch (mutative + zustand)

What’s implemented

- Normalized state: nodes table, per-node meta (childrenIds, isExpanded, hasMore, nextCursor), rootIds + root pagination, in-flight flags per parent, and danglingByParent bucket for children whose parent is not yet loaded.
- Actions: upsertNodes merges pages into the store (attaches any dangling children when their parent arrives), toggleExpanded flips UI state, moveNode updates parent/ordering, removeNode prunes nodes/refs, beginFetch/finishFetch gate one in-flight fetch per parentId (including root via **root**).
- Derivation: buildFlat walks expanded nodes to produce flat rows with depth plus loadMore sentinels (per parent and root).

How to use with TanStack Query

- One infinite query per parentId, key: ["notes", parentId]. Before fetchNextPage, call beginFetch(parentId); if it returns false, skip to avoid duplicate fetch. In onSuccess, call upsertNodes(parentId, page.notes, { hasMore, nextCursor }). In onSettled, call finishFetch(parentId).
- Invalidate locally: queryClient.invalidateQueries(["notes", parentId]) rather than nuking root; merge keeps existing children.

Dangling handling

- If children arrive for a parent not in nodes yet, ids go into danglingByParent[parentId]; they do not render. When the parent eventually arrives, upsertNodes attaches the stored children and clears the bucket. Consider logging when danglingByParent is non-empty to catch API ordering issues.

Rendering

- Flat list uses buildFlat(selector) to get rows: kind=node rows carry id/depth; kind=loadMore rows carry parentId/depth. Indent by depth; load-more sentinel triggers fetchNextPage for that parent. Root pagination is represented by a loadMore row with parentId=null.

Notes/considerations

- Ordering is preserved by arrival order; if server adds position, sort before append. appendUnique avoids duplicates but keeps existing ordering.
- Expansion/fetch flow: toggleExpanded, and on expand when childrenIds are empty or hasMore is true, trigger fetchNextPage (guarded by beginFetch). Expansion state persists across refetches.
- Optimistic ops: create inserts temp node under parent; delete removes and invalidate parent; move updates parents locally then optionally invalidate both parents.
