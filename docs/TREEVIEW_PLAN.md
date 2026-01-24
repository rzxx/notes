# Tree View Plan

Goals: virtualizable tree UI from incremental (paginated) per-parent fetches; single source of truth; stable expansion state; no disappearing children on invalidation.

Data model

- Note: `{ id, parentId, title, hasChildren, ... }`
- Meta: `{ childrenIds: string[]; isExpanded: boolean; hasMore: boolean; nextCursor: string | null }`
- Store shape: `{ nodes: Record<id, Note>; meta: Record<id, Meta>; rootIds: string[]; danglingByParent: Record<id, string[]> }`
- Derive flat list; never store it. Each row: `node` (id, depth) or `loadMore` (parentId, depth). Memoize the derived list (selector-level or via `useMemo` on stable slices) so React 19 hydration doesn’t see changing snapshots.

State management

- Zustand + mutative for readable immutable updates.
- Helpers: `ensureMeta`, `appendUnique`. Order follows server arrival; no position field.
- One in-flight fetch per parent to prevent double-appends/races.

Core actions

- `upsertNodes(parentId, notes[], { hasMore, nextCursor })`: merge/replace node data; append unique child ids to the parent (or rootIds); set paging flags. If parent missing and parentId != null, stash child ids in `danglingByParent[parentId]` instead of rendering.
- `toggleExpanded(id, expanded?)`: flip/set expansion; components decide whether to fetch when expanding.
- `removeNode(id)`: delete node/meta; remove id from any parent childrenIds and rootIds.
- `moveNode(id, newParentId, index?)`: update parentId; remove from old parent/roots; insert into new parent/roots at index (default append); ensure new parent is expanded.

Dangling handling

- `danglingByParent[parentId]` collects child ids whose parent is not yet in `nodes`.
- When a parent is later upserted, merge its dangling children into its childrenIds and clear the bucket entry.
- Optional dev warning when `danglingByParent` non-empty to spot API/order issues.

Flatten derivation

- Walk `rootIds`; for each expanded node, emit its children; if `hasMore`, emit a `loadMore` sentinel row at depth+1. Depth is computed during walk. Derived selector only.

TanStack Query wiring

- One InfiniteQuery per parent: key `['notes', parentId]`. `getNextPageParam` from `nextCursor` when `hasMore`.
- `onSuccess`: for each page, call `upsertNodes(parentId, page.notes, { hasMore, nextCursor })`; this also resolves dangling children if the parent arrives.
- Invalidate locally: `invalidateQueries(['notes', parentId])`; do not clear children arrays on invalidate.

Fetching/expansion flow

- On expand: set `isExpanded=true`; if children empty or `hasMore` and no in-flight fetch, call `fetchNextPage` for that parent. Use server-provided `hasChildren` to gate expansion/fetch so leaf nodes don’t trigger pointless calls.
- Load-more sentinel uses IntersectionObserver; disabled while `isFetchingNextPage` to avoid double fetch.

Mutations

- Create: optimistic temp id under parent; replace or remove on settle.
- Delete: remove node; strip from parents/roots; invalidate that parent’s query to refresh paging flags.
- Move: local move; optionally invalidate old/new parents to sync ordering from server.

Error handling

- Fetch error on load-more: show retry state on sentinel; do not collapse expansion.
- If a fetch returns empty with `hasMore=true`, log/telemetry; likely cursor issue.

Performance notes

- Memoize flatten selector (shallow compare on involved slices) to avoid recompute on unrelated state.
- Consider depth cache only if profiling shows flatten cost; otherwise derive depth on walk.

UX basics

- Indent via `padding-left = depth * step` for virtualizable flat list.
- `loadMore` sentinel row distinct; shows spinner when fetching.

Open points to watch

- Large-tree memory: consider optional collapse-to-evict if needed later.
