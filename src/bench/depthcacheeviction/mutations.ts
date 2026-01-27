import type { Fixture, NoteId } from "./generator";
import type { RuntimeStore } from "./store";
import { collapseNode, expandNode, insertNode, moveNode, removeNode, setHasMore } from "./store";

export type MutationOp =
  | { kind: "insert"; parentId: NoteId | null; createdAt: string }
  | { kind: "move"; id: NoteId; newParentId: NoteId | null }
  | { kind: "remove"; id: NoteId }
  | { kind: "collapse"; id: NoteId }
  | { kind: "expand"; id: NoteId }
  | { kind: "setHasMore"; parentId: NoteId | null; hasMore: boolean };

export function buildMutationScript(fixture: Fixture): MutationOp[] {
  const ops: MutationOp[] = [];
  const state = createMutableState(fixture);
  const initialSize = state.alive.size;
  const totalOps = computeOpsBudget(fixture.targetNodes);
  const rng = makeRng(fixture.seed + 101);

  let createdAtCursor = findMaxCreatedAt(fixture);
  const minAlive = Math.max(6, Math.floor(initialSize * 0.05));
  const maxRemovals = Math.min(Math.floor(initialSize * 0.2), initialSize - minAlive);
  let removals = 0;

  for (let i = 0; i < totalOps; i++) {
    const roll = rng();
    const canRemove = removals < maxRemovals && state.alive.size > minAlive + 1;
    const canMove = state.alive.size > 1;

    if (roll < 0.45 && canMove) {
      const moveOp = makeMoveOp(state, rng);
      if (moveOp) {
        ops.push(moveOp);
        continue;
      }
    }

    if (roll < 0.8 || !canRemove) {
      createdAtCursor += 1;
      ops.push(makeInsertOp(state, rng, createdAtCursor));
      continue;
    }

    const removeOp = makeRemoveOp(state, rng);
    if (removeOp) {
      removals += 1;
      ops.push(removeOp);
      continue;
    }

    const fallbackMove = makeMoveOp(state, rng);
    if (fallbackMove) {
      ops.push(fallbackMove);
    } else {
      createdAtCursor += 1;
      ops.push(makeInsertOp(state, rng, createdAtCursor));
    }
  }

  ops.push(...buildInteractionOps(state, rng));
  ops.push(...buildPaginationOps(state, rng));

  return ops;
}

export function applyMutations(store: RuntimeStore, ops: MutationOp[]): void {
  for (const op of ops) {
    switch (op.kind) {
      case "insert":
        insertNode(store, op.parentId, op.createdAt);
        break;
      case "move":
        moveNode(store, op.id, op.newParentId);
        break;
      case "remove":
        removeNode(store, op.id);
        break;
      case "collapse":
        collapseNode(store, op.id);
        break;
      case "expand":
        expandNode(store, op.id);
        break;
      case "setHasMore":
        setHasMore(store, op.parentId, op.hasMore);
        break;
    }
  }
}

type MutableState = {
  parent: Map<NoteId, NoteId | null>;
  children: Map<NoteId, NoteId[]>;
  alive: Set<NoteId>;
  roots: Set<NoteId>;
  expanded: Set<NoteId>;
  rootsHasMore: boolean;
};

function createMutableState(fixture: Fixture): MutableState {
  const parent = new Map<NoteId, NoteId | null>();
  const children = new Map<NoteId, NoteId[]>();
  const roots = new Set<NoteId>();
  const expanded = new Set<NoteId>();
  const rootsHasMore = fixture.store.rootPagination.hasMore;

  for (const id of fixture.nodeIds) {
    const node = fixture.store.nodes[id];
    parent.set(id, node.parentId);
    if (node.parentId === null) {
      roots.add(id);
    }
  }

  for (const [id, meta] of Object.entries(fixture.store.meta)) {
    children.set(id, [...meta.childrenIds]);
    if (meta.isExpanded) expanded.add(id);
  }

  return { parent, children, roots, expanded, rootsHasMore, alive: new Set(fixture.nodeIds) };
}

function makeInsertOp(state: MutableState, rng: () => number, createdAtCursor: number): MutationOp {
  const parentId = pickInsertParent(state, rng);
  return { kind: "insert", parentId, createdAt: formatCreatedAt(createdAtCursor) };
}

function makeMoveOp(state: MutableState, rng: () => number): MutationOp | null {
  const candidate = pickAlive(state, rng);
  if (!candidate) return null;

  const newParent = pickMoveParent(state, candidate, rng);
  if (newParent === undefined) return null;

  rewire(state, candidate, newParent);
  return { kind: "move", id: candidate, newParentId: newParent };
}

function makeRemoveOp(state: MutableState, rng: () => number): MutationOp | null {
  const candidate = pickRemovable(state, rng);
  if (!candidate) return null;
  removeSingle(state, candidate);
  return { kind: "remove", id: candidate };
}

function pickAlive(state: MutableState, rng: () => number): NoteId | null {
  const ids = Array.from(state.alive);
  if (!ids.length) return null;
  const idx = Math.floor(rng() * ids.length);
  return ids[idx];
}

function pickInsertParent(state: MutableState, rng: () => number): NoteId | null {
  if (state.alive.size === 0) return null;
  if (rng() < 0.12) return null;
  return pickAlive(state, rng);
}

function pickMoveParent(
  state: MutableState,
  id: NoteId,
  rng: () => number,
): NoteId | null | undefined {
  const forbidden = collectDescendants(state, id);
  forbidden.add(id);

  const candidates = Array.from(state.alive).filter((candidate) => !forbidden.has(candidate));
  if (candidates.length === 0) return rng() < 0.5 ? null : undefined;

  if (rng() < 0.15) return null;
  const idx = Math.floor(rng() * candidates.length);
  return candidates[idx];
}

function pickRemovable(state: MutableState, rng: () => number): NoteId | null {
  const ids = Array.from(state.alive);
  if (!ids.length) return null;

  const maxFootprint = Math.max(5, Math.floor(state.alive.size * 0.02));
  const attempts = Math.min(6, ids.length);

  for (let i = 0; i < attempts; i++) {
    const candidate = ids[Math.floor(rng() * ids.length)];
    if (state.roots.has(candidate)) continue;
    const size = subtreeSize(state, candidate);
    if (size <= maxFootprint) return candidate;
  }

  const nonRoot = ids.find((id) => !state.roots.has(id));
  return nonRoot ?? ids[0];
}

function rewire(state: MutableState, id: NoteId, newParent: NoteId | null) {
  const oldParent = state.parent.get(id) ?? null;
  if (oldParent === newParent) return;

  if (oldParent === null) {
    state.roots.delete(id);
  } else {
    const siblings = state.children.get(oldParent);
    if (siblings) removeFromList(siblings, id);
  }

  if (newParent === null) {
    state.roots.add(id);
  } else {
    const siblings = state.children.get(newParent) ?? [];
    siblings.push(id);
    state.children.set(newParent, siblings);
  }

  state.parent.set(id, newParent);
}

function removeSingle(state: MutableState, id: NoteId) {
  const oldParent = state.parent.get(id) ?? null;

  if (oldParent === null) {
    state.roots.delete(id);
  } else {
    const siblings = state.children.get(oldParent);
    if (siblings) removeFromList(siblings, id);
  }

  state.alive.delete(id);
  state.expanded.delete(id);
  state.parent.delete(id);
  state.children.delete(id);
  state.roots.delete(id);

  for (const siblings of state.children.values()) {
    removeFromList(siblings, id);
  }
}

function collectDescendants(state: MutableState, id: NoteId): Set<NoteId> {
  const found = new Set<NoteId>();
  const stack: NoteId[] = [...(state.children.get(id) ?? [])];

  while (stack.length) {
    const current = stack.pop()!;
    if (found.has(current)) continue;
    found.add(current);
    const kids = state.children.get(current);
    if (kids) {
      for (const child of kids) stack.push(child);
    }
  }

  return found;
}

function subtreeSize(state: MutableState, id: NoteId): number {
  let count = 0;
  const stack: NoteId[] = [id];
  while (stack.length) {
    const current = stack.pop()!;
    count += 1;
    const kids = state.children.get(current);
    if (kids) {
      for (const child of kids) stack.push(child);
    }
  }
  return count;
}

function removeFromList(list: NoteId[], id: NoteId) {
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
}

function computeOpsBudget(targetNodes: number): number {
  if (targetNodes <= 20) return 40;
  if (targetNodes <= 2_000) return 500;
  if (targetNodes <= 20_000) return 2_000;
  if (targetNodes <= 90_000) return 3_500;
  return 6_000;
}

function buildInteractionOps(state: MutableState, rng: () => number): MutationOp[] {
  const candidates = collectExpandable(state);
  if (!candidates.length) return [];

  const targetCount = Math.min(candidates.length, pickInteractionBudget(state.alive.size));
  if (targetCount === 0) return [];

  const picks = sampleWithoutReplacement(candidates, targetCount, rng);
  const ops: MutationOp[] = [];

  for (const id of picks) {
    if (!state.expanded.has(id)) {
      ops.push({ kind: "expand", id });
      state.expanded.add(id);
    }
    ops.push({ kind: "collapse", id });
    state.expanded.delete(id);
  }

  for (const id of picks) {
    ops.push({ kind: "expand", id });
    state.expanded.add(id);
  }

  return ops;
}

function collectExpandable(state: MutableState): NoteId[] {
  const out: NoteId[] = [];
  for (const id of state.alive) {
    const kids = state.children.get(id);
    if (kids && kids.length > 0) out.push(id);
  }
  return out;
}

function pickInteractionBudget(alive: number): number {
  const base = Math.floor(alive * 0.01);
  return Math.max(3, Math.min(30, base));
}

function sampleWithoutReplacement<T>(pool: T[], count: number, rng: () => number): T[] {
  const copy = [...pool];
  const result: T[] = [];
  for (let i = 0; i < count && copy.length; i++) {
    const idx = Math.floor(rng() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

function buildPaginationOps(state: MutableState, rng: () => number): MutationOp[] {
  const ops: MutationOp[] = [];

  if (state.roots.size > 0) {
    const flipRoot = rng() < 0.5;
    const nextRootHasMore = flipRoot ? !state.rootsHasMore : state.rootsHasMore;
    ops.push({ kind: "setHasMore", parentId: null, hasMore: nextRootHasMore });
    state.rootsHasMore = nextRootHasMore;
  }

  const candidates = collectExpandable(state);
  if (!candidates.length) return ops;

  const targetCount = Math.min(candidates.length, 5);
  const picks = sampleWithoutReplacement(candidates, targetCount, rng);

  picks.forEach((id, idx) => {
    const enable = rng() < 0.7;
    if (enable) {
      ops.push({ kind: "setHasMore", parentId: id, hasMore: true });
    }
    if (idx % 2 === 0) {
      ops.push({ kind: "setHasMore", parentId: id, hasMore: false });
    }
  });

  return ops;
}

function findMaxCreatedAt(fixture: Fixture): number {
  let max = 0;
  for (const node of Object.values(fixture.store.nodes)) {
    const value = Date.parse(node.createdAt);
    if (value > max) max = value;
  }
  return max;
}

function makeRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function formatCreatedAt(createdAtMs: number): string {
  return new Date(createdAtMs).toISOString();
}
