# Tree View Plan

Goals: virtualizable tree UI from incremental (paginated) per-parent fetches; single source of truth; stable expansion state; no disappearing children on invalidation.

Data model

- Note: `{ id, parentId, title, createdAt, hasChildren, ... }`
- Meta: `{ childrenIds: string[]; isExpanded: boolean; hasMore: boolean; nextCursor: string | null }`
- Store shape: `{ nodes: Record<id, Note>; meta: Record<id, Meta>; rootIds: string[]; danglingByParent: Record<id, string[]> }`
- Derive flat list; never store it. Each row: `node` (id, depth) or `loadMore` (parentId, depth). Memoize the derived list (selector-level or via `useMemo` on stable slices) so React 19 hydration doesn’t see changing snapshots.

State management

- Zustand + mutative for readable immutable updates.
- Helpers: `ensureMeta`, `mergeSortedIds`, `detachFromParent`. Order is derived from `createdAt` desc with `id` tiebreak; children/root ids stay sorted in store.
- Fetch gating uses TanStack Query state; avoid manual per-parent in-flight flags to prevent desync hangs.

Core actions

- `upsertNodes(parentId, notes[], { hasMore, nextCursor })`: merge/replace node data; detach from prior parent if parentId changes; merge child/root ids via sorted set; set paging flags. If parent missing and parentId != null, stash child ids in `danglingByParent[parentId]` instead of rendering.
- `toggleExpanded(id, expanded?)`: flip/set expansion; components decide whether to fetch when expanding.
- `removeNode(id)`: delete node/meta; remove id from any parent childrenIds and rootIds.
- `moveNode(id, newParentId, index?)`: update parentId; remove from old parent/roots; insert into new parent/roots via sorted merge (createdAt order); ensure new parent is expanded.

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
- Mount per-parent InfiniteQuery only for expandable nodes (hasChildren/hasMore/childrenIds>0) so true leaves do not register idle queries in devtools.

Fetching/expansion flow

- On expand: set `isExpanded=true`; if children empty or `hasMore`, trigger fetch unless Query already reports fetching. Use server-provided `hasChildren` to gate expansion/fetch so leaf nodes don’t trigger pointless calls.
- Load-more sentinel uses IntersectionObserver; auto-fetch on visible when not already fetching; still expose a retry button.

Mutations

- Create: optimistic temp id under parent; replace or remove on settle (store-driven, no refetch requirement).
- Delete: remove node optimistically; keep snapshot to restore on error; invalidate that parent’s query to refresh paging flags.
- Move: local move; keep old parent/index to restore on error; invalidate old/new parents to sync ordering from server.

- Error handling

- - Fetch error on load-more: show retry state on sentinel; do not collapse expansion. Surface retry attempts/remaining retries based on shared TanStack Query config (retry count/delay).
- - Timeout hung requests (shared timeout constant) to avoid stuck fetch state. If a fetch returns empty with `hasMore=true`, log/telemetry; likely cursor issue.

Performance notes

- Memoize flatten selector (shallow compare on involved slices) to avoid recompute on unrelated state.
- Consider depth cache only if profiling shows flatten cost; otherwise derive depth on walk.

UX basics

- Indent via `padding-left = depth * step` for virtualizable flat list.
- `loadMore` sentinel row distinct; shows spinner when fetching.
- IntersectionObserver-driven load-more (root + children); auto-fetch on sight; show retry CTA only on failure. Optional attempt count on retry (e.g., "Retry (2/3)").

Open points to watch

- Large-tree memory: consider optional collapse-to-evict if needed later.
- Virtualization limits DOM size but not store size; eviction/auto-collapse only if profiling shows memory pressure.
- Depth cache only if profiling shows buildFlat is hot; current walk-based depth is fine.
- Memoization: today component-level `useMemo(buildFlat(slice))` is OK if TreeView is sole consumer; shared memoized selector if multiple consumers appear.
- Logging/telemetry: TODOs for (a) danglingByParent non-empty over time/attach events and (b) empty page with `hasMore=true` (cursor bug signal). Deferred until logging system exists.
- Retry UX: load-more sentinel keeps expansion, shows retry state; align with TanStack retry counts.
- Benchmarks: add bun bench to stress buildFlat (sizes/shapes), depth-cache prototype, and auto-collapse policy to decide if optimizations are needed.
