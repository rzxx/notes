"use client";

import { create as produce } from "mutative";
import { create } from "zustand";

type Note = {
  id: string;
  parentId: string | null;
  title: string;
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
  inFlightByParent: Record<string, boolean>;
};

type TreeActions = {
  upsertNodes: (parentId: string | null, notes: Note[], page: Pagination) => void;
  toggleExpanded: (id: string, expanded?: boolean) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, newParentId: string | null, index?: number) => void;
  beginFetch: (parentId: string | null) => boolean;
  finishFetch: (parentId: string | null) => void;
  restoreNode: (input: {
    node: Note;
    meta?: NodeMeta;
    parentId: string | null;
    index?: number;
  }) => void;
};

const ROOT_KEY = "__root__";

const parentKey = (parentId: string | null) => parentId ?? ROOT_KEY;

const ensureMeta = (meta: Record<string, NodeMeta>, id: string) => {
  if (!meta[id]) {
    meta[id] = { childrenIds: [], isExpanded: false, hasMore: false, nextCursor: null };
  }
  return meta[id];
};

const createdAtOrFallback = (node?: Note) => {
  const timestamp = node ? Date.parse(node.createdAt) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

const compareByCreatedAtDesc = (nodes: Record<string, Note>) => (a: string, b: string) => {
  const aTime = createdAtOrFallback(nodes[a]);
  const bTime = createdAtOrFallback(nodes[b]);
  if (aTime !== bTime) return bTime - aTime;
  return a.localeCompare(b);
};

const mergeSortedIds = (existing: string[], incoming: string[], nodes: Record<string, Note>) => {
  const merged = Array.from(new Set([...existing, ...incoming]));
  merged.sort(compareByCreatedAtDesc(nodes));
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
};

export const useTreeStore = create<TreeState & TreeActions>((set, get) => ({
  nodes: {},
  meta: {},
  rootIds: [],
  rootPagination: { hasMore: false, nextCursor: null },
  danglingByParent: {},
  inFlightByParent: {},

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
        delete draft.inFlightByParent[parentKey(id)];

        draft.rootIds = draft.rootIds.filter((rootId) => rootId !== id);

        Object.values(draft.meta).forEach((meta) => {
          meta.childrenIds = meta.childrenIds.filter((childId) => childId !== id);
        });
      }),
    ),

  moveNode: (id, newParentId, _index) =>
    set((state) =>
      produce(state, (draft) => {
        const node = draft.nodes[id];
        if (!node) return;

        if (newParentId !== null && !draft.nodes[newParentId]) return;

        const oldParentId = node.parentId;

        if (oldParentId === null) {
          draft.rootIds = withoutId(draft.rootIds, id);
        } else {
          const oldMeta = draft.meta[oldParentId];
          if (oldMeta) oldMeta.childrenIds = withoutId(oldMeta.childrenIds, id);
        }

        if (newParentId === null) {
          draft.rootIds = mergeSortedIds(draft.rootIds, [id], draft.nodes);
        } else {
          const newMeta = ensureMeta(draft.meta, newParentId);
          newMeta.childrenIds = mergeSortedIds(
            withoutId(newMeta.childrenIds, id),
            [id],
            draft.nodes,
          );
          newMeta.isExpanded = true;
        }

        node.parentId = newParentId;
      }),
    ),

  beginFetch: (parentId) => {
    let allowed = false;
    const key = parentKey(parentId);
    set((state) =>
      produce(state, (draft) => {
        if (!draft.inFlightByParent[key]) {
          draft.inFlightByParent[key] = true;
          allowed = true;
        }
      }),
    );
    return allowed;
  },

  finishFetch: (parentId) =>
    set((state) =>
      produce(state, (draft) => {
        const key = parentKey(parentId);
        draft.inFlightByParent[key] = false;
      }),
    ),

  restoreNode: ({ node, meta, parentId, index: _index }) =>
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
}));

export type { Note, NodeMeta, TreeState, TreeActions };

type NodeRow = { kind: "node"; id: string; depth: number };
type LoadMoreRow = { kind: "loadMore"; parentId: string | null; depth: number };

export type FlatRow = NodeRow | LoadMoreRow;

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
