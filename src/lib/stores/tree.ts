"use client";

import { compareRanks, rankAfter, rankBetween } from "@/lib/lexorank";
import { create as produce } from "mutative";
import { create } from "zustand";

type Note = {
  id: string;
  parentId: string | null;
  title: string;
  rank: string;
  hasChildren: boolean;
  createdAt: string;
};

type NodeMeta = {
  childrenIds: string[];
  isExpanded: boolean;
  hasMore: boolean;
  nextCursor: string | null;
};

type Pagination = {
  hasMore: boolean;
  nextCursor: string | null;
};

type TreeState = {
  nodes: Record<string, Note>;
  meta: Record<string, NodeMeta>;
  rootIds: string[];
  rootPagination: Pagination;
  danglingByParent: Record<string, string[]>;
  selectedId: string | null;
};

type TreeActions = {
  upsertNodes: (parentId: string | null, notes: Note[], page: Pagination) => void;
  toggleExpanded: (id: string, expanded?: boolean) => void;
  removeNode: (id: string) => void;
  deleteNodeAndLift: (id: string) => {
    node: Note;
    meta?: NodeMeta;
    parentId: string | null;
    index: number;
    childrenIds: string[];
  } | null;
  moveNodeWithSnapshot: (
    id: string,
    newParentId: string | null,
    options?: { beforeId?: string | null; afterId?: string | null },
  ) => {
    oldParentId: string | null;
    oldIndex: number;
  } | null;
  moveNode: (
    id: string,
    newParentId: string | null,
    options?: { beforeId?: string | null; afterId?: string | null },
  ) => void;
  restoreNode: (input: {
    node: Note;
    meta?: NodeMeta;
    parentId: string | null;
    index?: number;
  }) => void;
  select: (id: string) => void;
  clearSelection: () => void;
};

const ensureMeta = (meta: Record<string, NodeMeta>, id: string) => {
  if (!meta[id]) {
    meta[id] = { childrenIds: [], isExpanded: false, hasMore: false, nextCursor: null };
  }
  return meta[id];
};

const compareByRank = (nodes: Record<string, Note>) => (a: string, b: string) => {
  const aRank = nodes[a]?.rank ?? "";
  const bRank = nodes[b]?.rank ?? "";
  if (aRank !== bRank) return compareRanks(aRank, bRank);
  return a.localeCompare(b);
};

const mergeSortedIds = (existing: string[], incoming: string[], nodes: Record<string, Note>) => {
  const merged = Array.from(new Set([...existing, ...incoming]));
  merged.sort(compareByRank(nodes));
  return merged;
};

const withoutId = (list: string[], id: string) => list.filter((item) => item !== id);

const detachFromParent = (draft: TreeState, parentId: string | null, id: string) => {
  if (parentId === null) {
    draft.rootIds = withoutId(draft.rootIds, id);
    return;
  }

  const meta = draft.meta[parentId];
  if (meta) meta.childrenIds = withoutId(meta.childrenIds, id);

  const bucket = draft.danglingByParent[parentId];
  if (bucket) {
    draft.danglingByParent[parentId] = withoutId(bucket, id);
    if (draft.danglingByParent[parentId].length === 0) {
      delete draft.danglingByParent[parentId];
    }
  }
};

export const useTreeStore = create<TreeState & TreeActions>((set) => ({
  nodes: {},
  meta: {},
  rootIds: [],
  rootPagination: { hasMore: false, nextCursor: null },
  danglingByParent: {},
  selectedId: null,

  upsertNodes: (parentId, notes, page) =>
    set((state) =>
      produce(state, (draft) => {
        notes.forEach((note) => {
          const previousParent = draft.nodes[note.id]?.parentId ?? null;
          const nextParent = note.parentId ?? null;

          if (previousParent !== nextParent) {
            detachFromParent(draft, previousParent, note.id);
          }

          draft.nodes[note.id] = note;

          const dangling = draft.danglingByParent[note.id];
          if (dangling?.length) {
            const meta = ensureMeta(draft.meta, note.id);
            meta.childrenIds = mergeSortedIds(meta.childrenIds, dangling, draft.nodes);
            delete draft.danglingByParent[note.id];
          }
        });

        const ids = notes.map((note) => note.id);

        if (parentId === null) {
          draft.rootIds = mergeSortedIds(draft.rootIds, ids, draft.nodes);
          draft.rootPagination.hasMore = page.hasMore;
          draft.rootPagination.nextCursor = page.nextCursor;
          return;
        }

        if (!draft.nodes[parentId]) {
          const bucket = draft.danglingByParent[parentId] ?? [];
          draft.danglingByParent[parentId] = mergeSortedIds(bucket, ids, draft.nodes);
          return;
        }

        const meta = ensureMeta(draft.meta, parentId);
        meta.childrenIds = mergeSortedIds(meta.childrenIds, ids, draft.nodes);
        meta.hasMore = page.hasMore;
        meta.nextCursor = page.nextCursor;
      }),
    ),

  toggleExpanded: (id, expanded) =>
    set((state) =>
      produce(state, (draft) => {
        const meta = ensureMeta(draft.meta, id);
        meta.isExpanded = expanded ?? !meta.isExpanded;
      }),
    ),

  removeNode: (id) =>
    set((state) =>
      produce(state, (draft) => {
        delete draft.nodes[id];
        delete draft.meta[id];
        delete draft.danglingByParent[id];

        if (draft.selectedId === id) {
          draft.selectedId = null;
        }

        draft.rootIds = draft.rootIds.filter((rootId) => rootId !== id);

        Object.values(draft.meta).forEach((meta) => {
          meta.childrenIds = meta.childrenIds.filter((childId) => childId !== id);
        });
      }),
    ),

  deleteNodeAndLift: (id) => {
    let snapshot: {
      node: Note;
      meta?: NodeMeta;
      parentId: string | null;
      index: number;
      childrenIds: string[];
    } | null = null;

    set((state) =>
      produce(state, (draft) => {
        const node = draft.nodes[id];
        if (!node) return;

        const meta = draft.meta[id];
        const parentId = node.parentId ?? null;
        const parentMeta = parentId === null ? null : draft.meta[parentId];
        const index =
          parentId === null
            ? draft.rootIds.indexOf(id)
            : (parentMeta?.childrenIds.indexOf(id) ?? -1);
        const childrenIds = meta?.childrenIds ? [...meta.childrenIds] : [];

        snapshot = {
          node: { ...node },
          meta: meta ? { ...meta, childrenIds: [...meta.childrenIds] } : undefined,
          parentId,
          index,
          childrenIds,
        };

        const parentList = parentId === null ? draft.rootIds : (parentMeta?.childrenIds ?? []);
        const nextSiblingId = index >= 0 ? (parentList[index + 1] ?? null) : null;
        const nextSiblingRank = nextSiblingId ? (draft.nodes[nextSiblingId]?.rank ?? null) : null;

        const orderedChildren = [...childrenIds].sort(compareByRank(draft.nodes));
        let prevRank = node.rank;

        orderedChildren.forEach((childId, childIndex) => {
          const child = draft.nodes[childId];
          if (!child) return;

          const oldParentId = child.parentId ?? null;
          detachFromParent(draft, oldParentId, childId);

          const newRank =
            childIndex === 0
              ? node.rank
              : nextSiblingRank
                ? rankBetween(prevRank, nextSiblingRank)
                : rankAfter(prevRank);

          prevRank = newRank;
          child.parentId = parentId;
          child.rank = newRank;
        });

        if (parentId === null) {
          draft.rootIds = mergeSortedIds(draft.rootIds, orderedChildren, draft.nodes);
        } else {
          const newMeta = ensureMeta(draft.meta, parentId);
          newMeta.childrenIds = mergeSortedIds(
            withoutId(newMeta.childrenIds, id),
            orderedChildren,
            draft.nodes,
          );
          newMeta.isExpanded = true;
        }

        delete draft.nodes[id];
        delete draft.meta[id];
        delete draft.danglingByParent[id];

        if (draft.selectedId === id) {
          draft.selectedId = null;
        }

        draft.rootIds = withoutId(draft.rootIds, id);

        Object.values(draft.meta).forEach((meta) => {
          meta.childrenIds = withoutId(meta.childrenIds, id);
        });
      }),
    );

    return snapshot;
  },

  moveNodeWithSnapshot: (id, newParentId, options) => {
    let snapshot: { oldParentId: string | null; oldIndex: number } | null = null;

    set((state) =>
      produce(state, (draft) => {
        const node = draft.nodes[id];
        if (!node) return;

        const oldParentId = node.parentId ?? null;
        const oldParentMeta = oldParentId === null ? null : draft.meta[oldParentId];
        const oldIndex =
          oldParentId === null
            ? draft.rootIds.indexOf(id)
            : (oldParentMeta?.childrenIds.indexOf(id) ?? -1);

        snapshot = { oldParentId, oldIndex };

        if (newParentId !== null && !draft.nodes[newParentId]) {
          detachFromParent(draft, oldParentId, id);
          const bucket = draft.danglingByParent[newParentId] ?? [];
          draft.danglingByParent[newParentId] = mergeSortedIds(bucket, [id], draft.nodes);
          node.parentId = newParentId;
          return;
        }

        const insert = (list: string[]) => {
          const filtered = withoutId(list, id);
          if (options?.beforeId) {
            const idx = filtered.indexOf(options.beforeId);
            if (idx >= 0) {
              filtered.splice(idx, 0, id);
              return filtered;
            }
          }

          if (options?.afterId) {
            const idx = filtered.indexOf(options.afterId);
            if (idx >= 0) {
              filtered.splice(idx + 1, 0, id);
              return filtered;
            }
          }

          filtered.push(id);
          return filtered;
        };

        if (oldParentId === null) {
          draft.rootIds = withoutId(draft.rootIds, id);
        } else {
          const oldMeta = draft.meta[oldParentId];
          if (oldMeta) oldMeta.childrenIds = withoutId(oldMeta.childrenIds, id);
        }

        if (newParentId === null) {
          draft.rootIds = insert(draft.rootIds);
        } else {
          const newMeta = ensureMeta(draft.meta, newParentId);
          newMeta.childrenIds = insert(newMeta.childrenIds);
          newMeta.isExpanded = true;
        }

        node.parentId = newParentId;
      }),
    );

    return snapshot;
  },

  moveNode: (id, newParentId, options) =>
    set((state) =>
      produce(state, (draft) => {
        const node = draft.nodes[id];
        if (!node) return;

        const oldParentId = node.parentId;

        if (newParentId !== null && !draft.nodes[newParentId]) {
          detachFromParent(draft, oldParentId, id);
          const bucket = draft.danglingByParent[newParentId] ?? [];
          draft.danglingByParent[newParentId] = mergeSortedIds(bucket, [id], draft.nodes);
          node.parentId = newParentId;
          return;
        }

        const insert = (list: string[]) => {
          const filtered = withoutId(list, id);
          if (options?.beforeId) {
            const idx = filtered.indexOf(options.beforeId);
            if (idx >= 0) {
              filtered.splice(idx, 0, id);
              return filtered;
            }
          }

          if (options?.afterId) {
            const idx = filtered.indexOf(options.afterId);
            if (idx >= 0) {
              filtered.splice(idx + 1, 0, id);
              return filtered;
            }
          }

          filtered.push(id);
          return filtered;
        };

        if (oldParentId === null) {
          draft.rootIds = withoutId(draft.rootIds, id);
        } else {
          const oldMeta = draft.meta[oldParentId];
          if (oldMeta) oldMeta.childrenIds = withoutId(oldMeta.childrenIds, id);
        }

        if (newParentId === null) {
          draft.rootIds = insert(draft.rootIds);
        } else {
          const newMeta = ensureMeta(draft.meta, newParentId);
          newMeta.childrenIds = insert(newMeta.childrenIds);
          newMeta.isExpanded = true;
        }

        node.parentId = newParentId;
      }),
    ),

  restoreNode: ({ node, meta, parentId }) =>
    set((state) =>
      produce(state, (draft) => {
        draft.nodes[node.id] = node;
        if (meta) {
          draft.meta[node.id] = meta;
        }

        if (parentId === null) {
          draft.rootIds = mergeSortedIds(withoutId(draft.rootIds, node.id), [node.id], draft.nodes);
          return;
        }

        const parentMeta = ensureMeta(draft.meta, parentId);
        parentMeta.childrenIds = mergeSortedIds(
          withoutId(parentMeta.childrenIds, node.id),
          [node.id],
          draft.nodes,
        );
      }),
    ),

  select: (id) =>
    set((state) =>
      produce(state, (draft) => {
        draft.selectedId = id;
      }),
    ),

  clearSelection: () =>
    set((state) =>
      produce(state, (draft) => {
        draft.selectedId = null;
      }),
    ),
}));

export type { Note, NodeMeta, TreeState, TreeActions };

type NodeRow = { kind: "node"; id: string; depth: number };
type LoadMoreRow = { kind: "loadMore"; parentId: string | null; depth: number };
type PlaceholderRow = {
  kind: "placeholder";
  parentId: string | null;
  depth: number;
  position: "before" | "after" | "inside";
};

export type FlatRow = NodeRow | LoadMoreRow | PlaceholderRow;

const makeFlatSelector = () => {
  let prevRootIds: string[] | null = null;
  let prevMeta: TreeState["meta"] | null = null;
  let prevRootHasMore: boolean | null = null;
  let prevRootCursor: string | null = null;
  let prevResult: FlatRow[] = [];

  return (state: Pick<TreeState, "meta" | "rootIds" | "rootPagination">): FlatRow[] => {
    const sameRootIds = prevRootIds === state.rootIds;
    const sameMeta = prevMeta === state.meta;
    const sameRootPagination =
      prevRootHasMore === state.rootPagination.hasMore &&
      prevRootCursor === state.rootPagination.nextCursor;

    if (sameRootIds && sameMeta && sameRootPagination) {
      return prevResult;
    }

    prevRootIds = state.rootIds;
    prevMeta = state.meta;
    prevRootHasMore = state.rootPagination.hasMore;
    prevRootCursor = state.rootPagination.nextCursor;
    prevResult = buildFlat(state);
    return prevResult;
  };
};

const flatSelector = makeFlatSelector();

export const selectFlatRows = (state: TreeState) =>
  flatSelector({
    meta: state.meta,
    rootIds: state.rootIds,
    rootPagination: state.rootPagination,
  });

export function buildFlat(
  state: Pick<TreeState, "meta" | "rootIds" | "rootPagination">,
): FlatRow[] {
  const out: FlatRow[] = [];

  const walk = (id: string, depth: number) => {
    out.push({ kind: "node", id, depth });
    const meta = state.meta[id];
    if (!meta?.isExpanded) return;

    meta.childrenIds.forEach((childId) => walk(childId, depth + 1));
    if (meta.hasMore) out.push({ kind: "loadMore", parentId: id, depth: depth + 1 });
  };

  state.rootIds.forEach((id) => walk(id, 0));

  if (state.rootPagination.hasMore) {
    out.push({ kind: "loadMore", parentId: null, depth: 0 });
  }

  return out;
}
