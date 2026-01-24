export type TreeNodeMeta = {
  id: string;
  parentId: string | null;
  title: string;
  hasChildren: boolean;
};

export type ParentChildrenPages = {
  pages?: TreeNodeMeta[][];
  nextCursor?: string | null;
  isLoading?: boolean;
  isError?: boolean;
};

export type ChildrenPagesLookup =
  | Map<string | null, ParentChildrenPages>
  | Record<string, ParentChildrenPages>;

export type TreeNodeRow = {
  kind: "node";
  id: string;
  title: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isLoading?: boolean;
};

export type LoadMoreRow = {
  kind: "load-more";
  parentId: string | null;
  depth: number;
  isLoading: boolean;
  hasMore: boolean;
  isError?: boolean;
};

export type TreeRow = TreeNodeRow | LoadMoreRow;

const ROOT_KEY = "__root__";

const getChildrenEntry = (
  lookup: ChildrenPagesLookup,
  parentId: string | null,
): ParentChildrenPages | undefined => {
  if (lookup instanceof Map) {
    return lookup.get(parentId ?? null);
  }

  const key = parentId ?? ROOT_KEY;
  return lookup[key];
};

type StackItem =
  | { kind: "node"; id: string; depth: number }
  | {
      kind: "load-more";
      parentId: string | null;
      depth: number;
      isLoading: boolean;
      hasMore: boolean;
      isError?: boolean;
    };

export function flattenTreeRows(input: {
  rootIds: string[];
  nodes: Record<string, TreeNodeMeta>;
  expanded: Set<string>;
  childrenPages: ChildrenPagesLookup;
}): TreeRow[] {
  const rows: TreeRow[] = [];
  const stack: StackItem[] = [...input.rootIds]
    .reverse()
    .map((id) => ({ kind: "node", id, depth: 0 }));

  while (stack.length) {
    const current = stack.pop()!;

    if (current.kind === "load-more") {
      if (current.hasMore) {
        rows.push({
          kind: "load-more",
          parentId: current.parentId,
          depth: current.depth,
          hasMore: true,
          isLoading: current.isLoading,
          isError: current.isError,
        });
      }
      continue;
    }

    const node = input.nodes[current.id];
    if (!node) continue;

    const isExpanded = input.expanded.has(current.id);
    const childEntry = getChildrenEntry(input.childrenPages, current.id);
    const isLoadingChildren =
      isExpanded && (Boolean(childEntry?.isLoading) || (!childEntry && node.hasChildren));

    rows.push({
      kind: "node",
      id: node.id,
      title: node.title,
      depth: current.depth,
      hasChildren: node.hasChildren,
      isExpanded,
      isLoading: isLoadingChildren || undefined,
    });

    if (!node.hasChildren || !isExpanded) continue;

    const children = childEntry?.pages?.flat() ?? [];
    const nextCursor = childEntry?.nextCursor ?? null;

    if (nextCursor) {
      stack.push({
        kind: "load-more",
        parentId: node.id,
        depth: current.depth + 1,
        hasMore: true,
        isLoading: Boolean(childEntry?.isLoading),
        isError: Boolean(childEntry?.isError),
      });
    }

    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i];
      if (!child) continue;
      stack.push({ kind: "node", id: child.id, depth: current.depth + 1 });
    }
  }

  return rows;
}
