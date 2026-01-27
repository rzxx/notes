export type NoteId = string;

export type Note = {
  id: NoteId;
  parentId: NoteId | null;
  title: string;
  createdAt: string;
  hasChildren: boolean;
};

export type Meta = {
  childrenIds: NoteId[];
  isExpanded: boolean;
  hasMore: boolean;
  nextCursor: string | null;
};

export type RootPagination = {
  hasMore: boolean;
  nextCursor: string | null;
};

export type Store = {
  nodes: Record<NoteId, Note>;
  meta: Record<NoteId, Meta>;
  rootIds: NoteId[];
  rootPagination: RootPagination;
  danglingByParent: Record<NoteId, NoteId[]>;
};

export type Fixture = {
  label: string;
  targetNodes: number;
  seed: number;
  store: Store;
  nodeIds: NoteId[];
};

const ROOT_EXPANDED_PROBABILITY = 0.35;
const CREATED_AT_EPOCH = Date.UTC(2024, 0, 1, 0, 0, 0, 0);

export const LEVELS: Fixture[] = buildLevels();

function buildLevels(): Fixture[] {
  const levels = [
    { label: "L1-tiny", targetNodes: 10, seed: 11 },
    { label: "L2-small", targetNodes: 1_000, seed: 22 },
    { label: "L3-medium", targetNodes: 15_000, seed: 33 },
    { label: "L4-large", targetNodes: 70_000, seed: 44 },
    { label: "L5-stress", targetNodes: 250_000, seed: 55 },
  ];

  return levels.map(({ label, targetNodes, seed }) => {
    const store = buildFixture(targetNodes, seed);
    return {
      label,
      targetNodes,
      seed,
      store,
      nodeIds: Object.keys(store.nodes),
    } satisfies Fixture;
  });
}

function buildFixture(targetNodes: number, seed: number): Store {
  const rng = makeRng(seed);
  let idCounter = 0;

  const wideTarget = Math.max(1, Math.floor(targetNodes * 0.4));
  const balancedTarget = Math.max(1, Math.floor(targetNodes * 0.4));
  const deepTarget = Math.max(1, targetNodes - wideTarget - balancedTarget);

  let wideUsed = 0;
  let balancedUsed = 0;
  let deepUsed = 0;

  const nodes: Record<NoteId, Note> = {};
  const meta: Record<NoteId, Meta> = {};
  const rootIds: NoteId[] = [];
  let expandedRootCount = 0;

  function newId(): NoteId {
    idCounter += 1;
    return `n${idCounter}`;
  }

  function addNode(parentId: NoteId | null): Note {
    const id = newId();
    const createdAt = formatCreatedAt(idCounter);
    const shouldExpand = parentId === null ? rng() < ROOT_EXPANDED_PROBABILITY : false;
    const node: Note = {
      id,
      parentId,
      title: `Node ${id}`,
      createdAt,
      hasChildren: false,
    };

    nodes[id] = node;
    meta[id] = {
      childrenIds: [],
      isExpanded: shouldExpand,
      hasMore: false,
      nextCursor: null,
    };

    if (parentId === null) {
      insertSortedUnique(rootIds, id, nodes);
      if (shouldExpand) {
        expandedRootCount += 1;
      }
    }

    return node;
  }

  function attachChild(parentId: NoteId, childId: NoteId) {
    insertSortedUnique(meta[parentId].childrenIds, childId, nodes);
  }

  function generateSubtree(
    parentId: NoteId,
    canAdd: () => boolean,
    noteAdded: () => void,
    fanoutRange: [number, number],
    depthRange: [number, number],
  ) {
    const queue: { id: NoteId; depth: number }[] = [{ id: parentId, depth: 0 }];

    while (queue.length && canAdd()) {
      const current = queue.shift()!;
      if (current.depth >= depthRange[1]) continue;

      const minFanout = fanoutRange[0];
      const maxFanout = fanoutRange[1];
      if (!canAdd()) break;

      const fanout = clamp(
        randomInt(rng, minFanout, maxFanout),
        0,
        Math.max(0, targetNodes - idCounter),
      );

      for (let i = 0; i < fanout && canAdd(); i++) {
        noteAdded();
        const child = addNode(current.id);
        attachChild(current.id, child.id);

        if (current.depth + 1 < depthRange[1] && rng() > 0.3) {
          queue.push({ id: child.id, depth: current.depth + 1 });
        }
      }
    }
  }

  function makeWideRoot(): void {
    if (!canUseWide()) return;
    wideUsed += 1;
    const root = addNode(null);
    generateSubtree(
      root.id,
      canUseWide,
      () => {
        wideUsed += 1;
      },
      [20, 80],
      [1, 3],
    );
  }

  function makeBalancedRoot(): void {
    if (!canUseBalanced()) return;
    balancedUsed += 1;
    const root = addNode(null);
    generateSubtree(
      root.id,
      canUseBalanced,
      () => {
        balancedUsed += 1;
      },
      [4, 8],
      [2, 6],
    );
  }

  function makeDeepRoot(): void {
    if (!canUseDeep()) return;
    deepUsed += 1;
    const root = addNode(null);
    let depth = 0;
    let current = root.id;
    while (canUseDeep() && depth < randomInt(rng, 30, 60)) {
      deepUsed += 1;
      const child = addNode(current);
      attachChild(current, child.id);
      current = child.id;
      depth += 1;
    }
  }

  function totalBudget(): boolean {
    return idCounter < targetNodes;
  }
  function canUseWide(): boolean {
    return totalBudget() && wideUsed < wideTarget;
  }

  function canUseBalanced(): boolean {
    return totalBudget() && balancedUsed < balancedTarget;
  }

  function canUseDeep(): boolean {
    return totalBudget() && deepUsed < deepTarget;
  }

  while (canUseWide()) {
    makeWideRoot();
  }

  while (canUseBalanced()) {
    makeBalancedRoot();
  }

  while (canUseDeep()) {
    makeDeepRoot();
  }

  Object.values(nodes).forEach((node) => {
    node.hasChildren = meta[node.id].childrenIds.length > 0;
  });

  if (expandedRootCount === 0 && rootIds.length > 0) {
    meta[rootIds[0]].isExpanded = true;
    expandedRootCount = 1;
  }

  const rootPagination = buildRootPagination(rootIds, targetNodes, seed);

  return { nodes, meta, rootIds, rootPagination, danglingByParent: {} };
}

function formatCreatedAt(counter: number): string {
  return new Date(CREATED_AT_EPOCH + counter).toISOString();
}

function buildRootPagination(rootIds: NoteId[], targetNodes: number, seed: number): RootPagination {
  const rng = makeRng(seed + 7);
  const hasMore = rootIds.length > 3 && targetNodes >= 200 ? true : rng() < 0.4;
  return {
    hasMore,
    nextCursor: hasMore ? "root-cursor" : null,
  };
}

function insertSortedUnique(list: NoteId[], id: NoteId, nodes: Record<NoteId, Note>) {
  if (list.includes(id)) return;
  if (list.length === 0) {
    list.push(id);
    return;
  }

  let low = 0;
  let high = list.length;

  while (low < high) {
    const mid = (low + high) >> 1;
    const cmp = compareNodes(nodes, id, list[mid]);
    if (cmp < 0) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  list.splice(low, 0, id);
}

function compareNodes(nodes: Record<NoteId, Note>, a: NoteId, b: NoteId): number {
  const nodeA = nodes[a];
  const nodeB = nodes[b];
  if (!nodeA || !nodeB) return 0;

  const aTime = Date.parse(nodeA.createdAt);
  const bTime = Date.parse(nodeB.createdAt);

  if (aTime === bTime) return nodeA.id.localeCompare(nodeB.id);
  return bTime - aTime;
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

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
