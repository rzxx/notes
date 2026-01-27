import type { Meta, Note, NoteId, RootPagination, Store } from "./generator";

export type VariantConfig = {
  depthCache: boolean;
  eviction: boolean;
};

export type RuntimeStore = Store & {
  depthCache?: Record<NoteId, number>;
  evictedChildren?: Record<NoteId, NoteId[]>;
  config: VariantConfig;
  nextId: number;
};

export type FlatRow =
  | { kind: "node"; id: NoteId; depth: number }
  | { kind: "loadMore"; parentId: NoteId | null; depth: number };

export function setHasMore(store: RuntimeStore, parentId: NoteId | null, hasMore: boolean) {
  if (parentId === null) {
    store.rootPagination.hasMore = hasMore;
    return;
  }

  const meta = store.meta[parentId];
  if (!meta) return;
  meta.hasMore = hasMore;
}

export function collapseNode(store: RuntimeStore, id: NoteId) {
  const meta = store.meta[id];
  if (!meta) return;

  const wasExpanded = meta.isExpanded;
  meta.isExpanded = false;

  if (!store.config.eviction) return;

  if (wasExpanded || meta.childrenIds.length > 0) {
    evictChildren(store, id);
  }
}

export function expandNode(store: RuntimeStore, id: NoteId) {
  const meta = store.meta[id];
  if (!meta) return;

  if (meta.isExpanded) return;
  meta.isExpanded = true;

  if (store.config.eviction) {
    restoreEvictedChildren(store, id);
  }
}

export const VARIANTS: Record<string, VariantConfig> = {
  baseline: { depthCache: false, eviction: false },
  depthCache: { depthCache: true, eviction: false },
  eviction: { depthCache: false, eviction: true },
  depthCacheEviction: { depthCache: true, eviction: true },
};

export function makeRuntimeStore(base: Store, config: VariantConfig): RuntimeStore {
  const nodes: Record<NoteId, Note> = {};
  const meta: Record<NoteId, Meta> = {};
  const rootPagination: RootPagination = {
    hasMore: base.rootPagination.hasMore,
    nextCursor: base.rootPagination.nextCursor,
  };
  const danglingByParent: Record<NoteId, NoteId[]> = {};

  for (const [id, node] of Object.entries(base.nodes)) {
    nodes[id] = { ...node };
  }

  for (const [id, m] of Object.entries(base.meta)) {
    meta[id] = {
      childrenIds: [...m.childrenIds],
      isExpanded: m.isExpanded,
      hasMore: m.hasMore,
      nextCursor: m.nextCursor,
    };
  }

  for (const [parentId, ids] of Object.entries(base.danglingByParent)) {
    danglingByParent[parentId] = [...ids];
  }

  const rootIds = [...base.rootIds];
  const runtime: RuntimeStore = {
    nodes,
    meta,
    rootIds,
    rootPagination,
    danglingByParent,
    evictedChildren: config.eviction ? {} : undefined,
    config,
    nextId: computeNextId(nodes),
  };

  resolveDanglingForAllParents(runtime);

  if (config.depthCache) {
    runtime.depthCache = buildDepthCache(runtime);
  }

  if (config.eviction) {
    primeEviction(runtime);
  }

  return runtime;
}

type StackEntry =
  | { kind: "node"; id: NoteId; depth: number }
  | { kind: "loadMore"; parentId: NoteId | null; depth: number };

export function buildFlatRows(store: RuntimeStore): FlatRow[] {
  const rows: FlatRow[] = [];
  const stack: StackEntry[] = [...store.rootIds]
    .reverse()
    .map((id) => ({ kind: "node", id, depth: 0 }));

  while (stack.length) {
    const entry = stack.pop()!;

    if (entry.kind === "loadMore") {
      rows.push(entry);
      continue;
    }

    const meta = store.meta[entry.id];
    const depth = store.depthCache?.[entry.id] ?? entry.depth;

    rows.push({ kind: "node", id: entry.id, depth });

    if (!meta || !meta.isExpanded) continue;

    if (store.config.eviction) {
      restoreEvictedChildren(store, entry.id);
    }

    const children = meta.childrenIds;

    if (meta.hasMore) {
      stack.push({ kind: "loadMore", parentId: entry.id, depth: depth + 1 });
    }

    for (let i = children.length - 1; i >= 0; i--) {
      const childId = children[i];
      const childDepth = store.depthCache?.[childId] ?? depth + 1;
      stack.push({ kind: "node", id: childId, depth: childDepth });
    }
  }

  if (store.rootPagination.hasMore) {
    rows.push({ kind: "loadMore", parentId: null, depth: 0 });
  }

  return rows;
}

export function insertNode(
  store: RuntimeStore,
  parentId: NoteId | null,
  createdAt: string,
): NoteId {
  const id = `m${store.nextId}`;
  store.nextId += 1;

  const node: Note = {
    id,
    parentId,
    title: `Inserted ${id}`,
    createdAt,
    hasChildren: false,
  };

  store.nodes[id] = node;
  store.meta[id] = {
    childrenIds: [],
    isExpanded: false,
    hasMore: false,
    nextCursor: null,
  };

  const attached = attachToParent(store, id, parentId);

  if (store.config.depthCache) {
    if (attached) {
      updateDepthCacheForInsert(store, id, parentId);
    } else {
      store.depthCache![id] = parentId === null ? 0 : (store.depthCache?.[parentId] ?? 0) + 1;
    }
  }

  resolveDanglingForParent(store, id);

  return id;
}

export function moveNode(store: RuntimeStore, id: NoteId, newParentId: NoteId | null) {
  const node = store.nodes[id];
  if (!node) return;

  const oldParentId = node.parentId;
  if (oldParentId === newParentId) return;

  detachFromParent(store, id, oldParentId);
  node.parentId = newParentId;
  const attached = attachToParent(store, id, newParentId, { expandParent: true });

  if (store.config.depthCache) {
    if (attached) {
      updateDepthCacheForMove(store, id, newParentId);
    } else {
      store.depthCache![id] = newParentId === null ? 0 : (store.depthCache?.[newParentId] ?? 0) + 1;
    }
  }
}

export function removeNode(store: RuntimeStore, id: NoteId) {
  const node = store.nodes[id];
  if (!node) return;

  detachFromParent(store, id, node.parentId);

  delete store.nodes[id];
  if (store.depthCache) delete store.depthCache[id];

  const meta = store.meta[id];
  if (meta) {
    delete store.meta[id];
  }

  delete store.danglingByParent[id];

  removeFromList(store.rootIds, id);

  for (const entry of Object.values(store.meta)) {
    removeFromList(entry.childrenIds, id);
  }

  for (const bucket of Object.values(store.danglingByParent)) {
    removeFromList(bucket, id);
  }

  if (store.evictedChildren) {
    for (const [parentId, bucket] of Object.entries(store.evictedChildren)) {
      removeFromList(bucket, id);
      if (bucket.length === 0) {
        delete store.evictedChildren[parentId];
      }
    }
  }
}

function attachToParent(
  store: RuntimeStore,
  id: NoteId,
  parentId: NoteId | null,
  options?: { expandParent?: boolean },
): boolean {
  if (parentId === null) {
    replaceWithMerged(store.rootIds, mergeSortedIds(store.rootIds, [id], store.nodes));
    return true;
  }

  const parentMeta = store.meta[parentId];
  if (!parentMeta) {
    parkDangling(store, parentId, id);
    return false;
  }

  if (store.config.eviction && !parentMeta.isExpanded) {
    const evictedBuckets = store.evictedChildren ?? (store.evictedChildren = {});
    const bucket = evictedBuckets[parentId] ?? [];
    replaceWithMerged(bucket, mergeSortedIds(bucket, [id], store.nodes));
    evictedBuckets[parentId] = bucket;
    store.nodes[parentId].hasChildren = true;

    if (store.config.depthCache) {
      updateDepthCacheForInsert(store, id, parentId);
    }

    return true;
  }

  if (store.config.eviction && parentMeta.isExpanded) {
    restoreEvictedChildren(store, parentId);
  }

  replaceWithMerged(
    parentMeta.childrenIds,
    mergeSortedIds(parentMeta.childrenIds, [id], store.nodes),
  );
  if (options?.expandParent) {
    parentMeta.isExpanded = true;
  }

  store.nodes[parentId].hasChildren = parentMeta.childrenIds.length > 0;
  return true;
}

function detachFromParent(store: RuntimeStore, id: NoteId, parentId: NoteId | null) {
  if (parentId === null) {
    removeFromList(store.rootIds, id);
    return;
  }

  const parentMeta = store.meta[parentId];
  if (parentMeta) {
    if (store.config.eviction && store.evictedChildren?.[parentId]) {
      const bucket = store.evictedChildren[parentId];
      removeFromList(bucket, id);
      if (bucket.length === 0) delete store.evictedChildren[parentId];
    }

    removeFromList(parentMeta.childrenIds, id);
    const evictedCount = store.evictedChildren?.[parentId]?.length ?? 0;
    store.nodes[parentId].hasChildren = parentMeta.childrenIds.length + evictedCount > 0;
    return;
  }

  const bucket = store.danglingByParent[parentId];
  if (!bucket) return;
  removeFromList(bucket, id);
  if (bucket.length === 0) delete store.danglingByParent[parentId];
}

function parkDangling(store: RuntimeStore, parentId: NoteId, childId: NoteId) {
  const bucket = store.danglingByParent[parentId] ?? [];
  if (!bucket.includes(childId)) {
    bucket.push(childId);
    store.danglingByParent[parentId] = bucket;
  }
}

function resolveDanglingForParent(store: RuntimeStore, parentId: NoteId) {
  const bucket = store.danglingByParent[parentId];
  const parentMeta = store.meta[parentId];
  if (!bucket?.length || !parentMeta) return;

  delete store.danglingByParent[parentId];

  const attachToEvicted = store.config.eviction && !parentMeta.isExpanded;

  for (const childId of bucket) {
    if (!store.nodes[childId]) continue;

    if (attachToEvicted) {
      const evictedBuckets = store.evictedChildren ?? (store.evictedChildren = {});
      const evicted = evictedBuckets[parentId] ?? [];
      replaceWithMerged(evicted, mergeSortedIds(evicted, [childId], store.nodes));
      evictedBuckets[parentId] = evicted;
      if (store.config.depthCache && store.depthCache) {
        updateDepthCacheForInsert(store, childId, parentId);
      }
      continue;
    }

    replaceWithMerged(
      parentMeta.childrenIds,
      mergeSortedIds(parentMeta.childrenIds, [childId], store.nodes),
    );
    if (store.config.depthCache && store.depthCache) {
      updateDepthCacheForMove(store, childId, parentId);
    }
  }

  const evictedCount = store.evictedChildren?.[parentId]?.length ?? 0;
  store.nodes[parentId].hasChildren = parentMeta.childrenIds.length + evictedCount > 0;
}

function resolveDanglingForAllParents(store: RuntimeStore) {
  for (const parentId of Object.keys(store.danglingByParent)) {
    resolveDanglingForParent(store, parentId);
  }
}

function removeFromList(list: NoteId[], id: NoteId) {
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
}

function compareNodes(nodes: Record<NoteId, Note>, a: NoteId, b: NoteId): number {
  const nodeA = nodes[a];
  const nodeB = nodes[b];
  if (!nodeA || !nodeB) return 0;
  const aTime = parseCreatedAt(nodeA.createdAt);
  const bTime = parseCreatedAt(nodeB.createdAt);
  if (aTime === bTime) return nodeA.id.localeCompare(nodeB.id);
  return bTime - aTime;
}

function parseCreatedAt(value: string): number {
  return Date.parse(value);
}

function mergeSortedIds(existing: NoteId[], incoming: NoteId[], nodes: Record<NoteId, Note>) {
  const merged = Array.from(new Set([...existing, ...incoming]));
  merged.sort((a, b) => compareNodes(nodes, a, b));
  return merged;
}

function replaceWithMerged(target: NoteId[], merged: NoteId[]) {
  target.splice(0, target.length, ...merged);
}

function primeEviction(store: RuntimeStore) {
  if (!store.config.eviction) return;
  if (!store.evictedChildren) store.evictedChildren = {};

  for (const [id, meta] of Object.entries(store.meta)) {
    if (meta.isExpanded || meta.childrenIds.length === 0) continue;
    evictChildren(store, id);
  }
}

function evictChildren(store: RuntimeStore, parentId: NoteId) {
  if (!store.config.eviction) return;
  if (!store.evictedChildren) store.evictedChildren = {};

  const meta = store.meta[parentId];
  if (!meta || meta.childrenIds.length === 0) return;

  const existing = store.evictedChildren[parentId] ?? [];
  const merged = mergeSortedIds(existing, meta.childrenIds, store.nodes);
  store.evictedChildren[parentId] = merged;
  meta.childrenIds = [];
  store.nodes[parentId].hasChildren = merged.length > 0;
}

function restoreEvictedChildren(store: RuntimeStore, parentId: NoteId) {
  if (!store.config.eviction || !store.evictedChildren) return;
  const evicted = store.evictedChildren[parentId];
  if (!evicted?.length) return;

  const parentMeta = store.meta[parentId];
  if (!parentMeta) return;

  const merged = mergeSortedIds(parentMeta.childrenIds, evicted, store.nodes);
  replaceWithMerged(parentMeta.childrenIds, merged);
  delete store.evictedChildren[parentId];
  store.nodes[parentId].hasChildren = parentMeta.childrenIds.length > 0;

  if (store.config.depthCache && store.depthCache) {
    const startDepth = (store.depthCache[parentId] ?? -1) + 1;
    const stack: { id: NoteId; depth: number }[] = evicted.map((childId) => ({
      id: childId,
      depth: startDepth,
    }));

    while (stack.length) {
      const current = stack.pop()!;
      store.depthCache[current.id] = current.depth;
      const kids = store.meta[current.id]?.childrenIds ?? [];
      for (const kid of kids) {
        stack.push({ id: kid, depth: current.depth + 1 });
      }
    }
  }
}

function buildDepthCache(store: Store): Record<NoteId, number> {
  const depth: Record<NoteId, number> = {};
  const stack: { id: NoteId; depth: number }[] = store.rootIds.map((id) => ({ id, depth: 0 }));

  while (stack.length) {
    const current = stack.pop()!;
    depth[current.id] = current.depth;
    const children = store.meta[current.id]?.childrenIds ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ id: children[i], depth: current.depth + 1 });
    }
  }

  return depth;
}

function updateDepthCacheForInsert(store: RuntimeStore, id: NoteId, parentId: NoteId | null) {
  const depth = parentId ? (store.depthCache?.[parentId] ?? 0) + 1 : 0;
  store.depthCache![id] = depth;
}

function updateDepthCacheForMove(store: RuntimeStore, id: NoteId, newParentId: NoteId | null) {
  const startDepth = newParentId ? (store.depthCache?.[newParentId] ?? 0) + 1 : 0;
  const stack: { id: NoteId; depth: number }[] = [{ id, depth: startDepth }];

  while (stack.length) {
    const current = stack.pop()!;
    store.depthCache![current.id] = current.depth;
    const children = store.meta[current.id]?.childrenIds ?? [];
    for (const child of children) {
      stack.push({ id: child, depth: current.depth + 1 });
    }
  }
}

function computeNextId(nodes: Record<NoteId, Note>): number {
  let max = 0;
  for (const id of Object.keys(nodes)) {
    const numeric = parseInt(id.replace(/\D+/g, ""), 10);
    if (!Number.isNaN(numeric)) {
      max = Math.max(max, numeric);
    }
  }
  return max + 1;
}
