"use client";

import { create as produce } from "mutative";
import { create } from "zustand";

type Note = {
  id: string;
  parentId: string | null;
  title: string;
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
};

const ROOT_KEY = "__root__";

const parentKey = (parentId: string | null) => parentId ?? ROOT_KEY;

const ensureMeta = (meta: Record<string, NodeMeta>, id: string) => {
  if (!meta[id]) {
    meta[id] = { childrenIds: [], isExpanded: false, hasMore: false, nextCursor: null };
  }
  return meta[id];
};

const appendUnique = (target: string[], ids: string[]) => {
  ids.forEach((id) => {
    if (!target.includes(id)) target.push(id);
  });
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
          draft.nodes[note.id] = note;

          const dangling = draft.danglingByParent[note.id];
          if (dangling?.length) {
            const meta = ensureMeta(draft.meta, note.id);
            appendUnique(meta.childrenIds, dangling);
            delete draft.danglingByParent[note.id];
          }
        });

        const ids = notes.map((note) => note.id);

        if (parentId === null) {
          appendUnique(draft.rootIds, ids);
          draft.rootPagination.hasMore = page.hasMore;
          draft.rootPagination.nextCursor = page.nextCursor;
          return;
        }

        if (!draft.nodes[parentId]) {
          const bucket = draft.danglingByParent[parentId] ?? [];
          appendUnique(bucket, ids);
          draft.danglingByParent[parentId] = bucket;
          return;
        }

        const meta = ensureMeta(draft.meta, parentId);
        appendUnique(meta.childrenIds, ids);
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

  moveNode: (id, newParentId, index) =>
    set((state) =>
      produce(state, (draft) => {
        const node = draft.nodes[id];
        if (!node) return;

        if (newParentId !== null && !draft.nodes[newParentId]) return;

        const oldParentId = node.parentId;

        if (oldParentId === null) {
          draft.rootIds = draft.rootIds.filter((rootId) => rootId !== id);
        } else {
          const oldMeta = draft.meta[oldParentId];
          if (oldMeta)
            oldMeta.childrenIds = oldMeta.childrenIds.filter((childId) => childId !== id);
        }

        if (newParentId === null) {
          const pos = index ?? draft.rootIds.length;
          draft.rootIds.splice(pos, 0, id);
        } else {
          const newMeta = ensureMeta(draft.meta, newParentId);
          newMeta.childrenIds = newMeta.childrenIds.filter((childId) => childId !== id);
          const pos = index ?? newMeta.childrenIds.length;
          newMeta.childrenIds.splice(pos, 0, id);
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
}));

export type { Note, NodeMeta, TreeState, TreeActions };

type NodeRow = { kind: "node"; id: string; depth: number };
type LoadMoreRow = { kind: "loadMore"; parentId: string | null; depth: number };

export type FlatRow = NodeRow | LoadMoreRow;

export function buildFlat(state: TreeState): FlatRow[] {
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
