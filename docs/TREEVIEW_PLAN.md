## Tree View Explorer Plan

### Goals

- Flat row list with per-row depth-based indent; rows carry only `id`, `title`, `hasChildren`, `depth`, `isExpanded`, `isLoading?`.
- Component roles: `TreeList` (state/flattening/virtualization hook-up), `TreeNodeRow` (behavior + event wiring), `TreeListItem` (pure UI).
- Ready to swap rendering surface between simple map and TanStack Virtual without changing data shape.

### Data Model

- Canonical tree map (by id) holds structure and metadata: `{ [id]: { parentId?: string | null; children?: string[]; hasChildren: boolean; title: string } }`.
- Expansion state: `expanded: Set<string>`.
- Derived render rows (flat):
  - Node row: `{ kind: "node", id, title, depth, hasChildren, isExpanded, isLoading?: boolean }`.
  - Load-more sentinel row: `{ kind: "load-more", parentId, depth, isLoading: boolean, hasMore: boolean }` (optional, for pagination).

### Pagination Strategy

- Per-parent cursor pagination via `useInfiniteQuery` keyed by `parentId`:
  - `queryKey: ["notes-children", parentId]`.
  - `getNextPageParam = (last) => last.nextCursor ?? undefined`.
  - `enabled: parentId === null || expanded.has(parentId)` to avoid prefetching collapsed branches.
- Fetch shape: `{ notes: NoteSummary[]; nextCursor: string | null }` where `NoteSummary` = `{ id, title, hasChildren, parentId }`.
- Append a `load-more` row at the end of a parent’s children when `nextCursor` is non-null.
- Trigger `fetchNextPage()` when the load-more row is visible:
  - Non-virtual: IntersectionObserver with button fallback.
  - Virtual: when the virtual item is in view (or within overscan), call `fetchNextPage`.

### Flattening Algorithm

- Input: `rootIds`, `nodes` map, `expanded` set, `childrenPages` lookup `{ [parentId]: { pages: NoteSummary[][]; nextCursor: string | null; status } }`.
- Process depth-first using a stack:
  - Push `{ id, depth }` for each root (reverse order for stack LIFO).
  - Pop → emit node row with `isExpanded = expanded.has(id)`.
  - If node has children and is expanded:
    - Collect children = `pages.flat()` for that parent (empty array if not loaded yet, plus `isLoading` flag).
    - Push children onto stack in reverse order with `depth + 1`.
    - After children, if `nextCursor` exists, emit `load-more` row at `depth + 1`.

### Components

- `TreeList`: owns expansion/selection, subscribes to per-parent queries, calls flattener, renders via map or virtualizer. Accepts `virtualized?: boolean` or `virtualizerProps`.
- `TreeNodeRow`: receives row data + handlers; handles toggle click and keyboard; signals `onToggle(id)` and `onLoadMore(parentId)` when sentinel appears.
- `TreeListItem`: dumb UI; props for `title`, `depth`, `hasChildren`, `isExpanded`, `isLoading`, `isSelected?`; indent via `padding-left = depth * indentSize`.
- `LoadMoreRow` (UI helper): shows spinner/button; calls `fetchNextPage` on visibility/button.

### Virtualization Hook-up (TanStack Virtual)

- Keep `rows` array as the single source of rendered items.
- Virtual config: `count = rows.length`, `getItemKey = rows[idx].kind === "node" ? rows[idx].id : ":load:" + rows[idx].parentId`, `estimateSize` (fixed) or `measureElement` (variable heights).
- `itemContent = (index) => renderRow(rows[index])` where renderRow switches on `kind`.
- Load-more triggering: if `rows[index].kind === "load-more"` and item is within overscan/in view, call `fetchNextPage` for that parent (guard on `isLoading`/`hasMore`).

### Fetching Function

- `fetchNotesChildren(parentId?: string | null, cursor?: string)` → GET `/api/notes?parentId=...&cursor=...` (existing API supports `limit` and `cursor`).

### UI/UX Notes

- Indent-only hierarchy; keep row content minimal.
- Caret only if `hasChildren`; spinner when loading children; placeholder/skeleton optional while first page loads.
- Selection is orthogonal: `selectedId` managed in `TreeList` and passed to `TreeListItem`.

### Next Steps to Implement

1. Add `fetchNotesChildren(parentId, cursor)` accepting cursor/limit; add `useNotesChildrenInfinite(parentId)` with `useInfiniteQuery`.
2. Build flattener that merges pages and appends `load-more` rows when `nextCursor` exists.
3. Implement `TreeList` using that flattener; render via simple map first, with an optional virtualizer path.
4. Add `TreeNodeRow` + `TreeListItem` + `LoadMoreRow` components; wire load-more triggering (IO for static, virtual index check for virtual).
5. Optional: prefetch first page on expand if not loaded; cache results per parent; handle `isLoading` and error states per parent.
