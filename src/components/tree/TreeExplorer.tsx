"use client";

import * as React from "react";
import { useQueries, useQueryClient, type UseInfiniteQueryResult } from "@tanstack/react-query";
import {
  fetchNotesChildren,
  useNotesChildrenInfinite,
  type NotesListItem,
  type NotesListResponse,
} from "@/lib/hooks/useNotesChildren";
import {
  flattenTreeRows,
  type ChildrenPagesLookup,
  type ParentChildrenPages,
  type TreeNodeMeta,
} from "@/lib/tree/flattenRows";
import TreeList from "./TreeList";

const DEFAULT_LIMIT = 50;

export function TreeExplorer() {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const rootQuery = useNotesChildrenInfinite(null, { enabled: true, limit: DEFAULT_LIMIT });

  const expandedParents = React.useMemo(() => Array.from(expanded), [expanded]);

  const childrenQueries = useQueries({
    queries: expandedParents.map((parentId) => ({
      queryKey: ["notes-children", parentId, DEFAULT_LIMIT] as const,
      initialPageParam: undefined as string | undefined,
      queryFn: ({ pageParam }: { pageParam?: unknown }) =>
        fetchNotesChildren({
          parentId,
          cursor: (pageParam as string | undefined) ?? undefined,
          limit: DEFAULT_LIMIT,
        }),
      getNextPageParam: (lastPage: NotesListResponse) => lastPage.nextCursor ?? undefined,
      enabled: true,
      type: "infinite" as const,
    })) as unknown as Parameters<typeof useQueries>[0]["queries"],
    combine: (results) => results as unknown as UseInfiniteQueryResult<NotesListResponse>[],
  });

  const childQueryMap = React.useMemo(() => {
    const map = new Map<string, UseInfiniteQueryResult<NotesListResponse>>();
    expandedParents.forEach((parentId, index) => {
      map.set(parentId, childrenQueries[index] as UseInfiniteQueryResult<NotesListResponse>);
    });
    return map;
  }, [childrenQueries, expandedParents]);

  const addNodes = (nodes: Record<string, TreeNodeMeta>, list?: NotesListItem[]) => {
    list?.forEach((item) => {
      nodes[item.id] = {
        id: item.id,
        parentId: item.parentId,
        title: item.title,
        hasChildren: item.hasChildren,
      };
    });
  };

  const buildChildrenPages = React.useCallback((): {
    lookup: ChildrenPagesLookup;
    nodes: Record<string, TreeNodeMeta>;
    rootIds: string[];
  } => {
    const lookup = new Map<string | null, ParentChildrenPages>();
    const nodes: Record<string, TreeNodeMeta> = {};

    const rootPages = (rootQuery.data?.pages ?? []) as NotesListResponse[];
    const rootNextCursor = rootPages[rootPages.length - 1]?.nextCursor ?? null;
    lookup.set(null, {
      pages: rootPages.map((page) => page.notes),
      nextCursor: rootNextCursor,
      isLoading: rootQuery.isFetching || rootQuery.isFetchingNextPage,
    });
    rootPages.forEach((page) => addNodes(nodes, page.notes));

    expandedParents.forEach((parentId) => {
      const query = childQueryMap.get(parentId) as
        | UseInfiniteQueryResult<NotesListResponse>
        | undefined;
      const pages =
        (((query?.data as unknown as { pages?: NotesListResponse[] })?.pages ?? []) as
          | NotesListResponse[]
          | undefined) || [];
      const nextCursor = pages[pages.length - 1]?.nextCursor ?? null;

      lookup.set(parentId, {
        pages: pages.map((page) => page.notes),
        nextCursor,
        isLoading: Boolean(query?.isFetching || query?.isFetchingNextPage),
      });

      pages.forEach((page) => addNodes(nodes, page.notes));
    });

    const rootIds = (rootPages.flatMap((page) => page.notes) ?? []).map((note) => note.id);

    return { lookup, nodes, rootIds };
  }, [
    childQueryMap,
    expandedParents,
    rootQuery.data,
    rootQuery.isFetching,
    rootQuery.isFetchingNextPage,
  ]);

  const {
    lookup: childrenPages,
    nodes,
    rootIds,
  } = React.useMemo(() => buildChildrenPages(), [buildChildrenPages]);

  const rows = React.useMemo(
    () => flattenTreeRows({ rootIds, nodes, expanded, childrenPages }),
    [childrenPages, expanded, nodes, rootIds],
  );

  const prefetchChildren = React.useCallback(
    (parentId: string) => {
      queryClient.prefetchInfiniteQuery({
        queryKey: ["notes-children", parentId, DEFAULT_LIMIT],
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) =>
          fetchNotesChildren({
            parentId,
            cursor: (pageParam as string | undefined) ?? undefined,
            limit: DEFAULT_LIMIT,
          }),
        getNextPageParam: (lastPage: NotesListResponse) => lastPage.nextCursor ?? undefined,
      });
    },
    [queryClient],
  );

  const handleToggle = React.useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        const willExpand = !next.has(id);
        if (willExpand) {
          next.add(id);
          prefetchChildren(id);
        } else {
          next.delete(id);
        }
        return next;
      });
      setSelectedId(id);
    },
    [prefetchChildren],
  );

  const handleLoadMore = React.useCallback(
    (parentId: string | null) => {
      if (parentId === null) {
        rootQuery.fetchNextPage();
        return;
      }
      childQueryMap.get(parentId)?.fetchNextPage();
    },
    [childQueryMap, rootQuery],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Notes</p>
          <p className="text-xs text-zinc-500">Expand a note to load its children.</p>
        </div>
        {rootQuery.isFetching && !rootQuery.data ? (
          <span className="text-xs text-zinc-500">Loading...</span>
        ) : null}
      </div>
      <TreeList
        rows={rows}
        onToggle={handleToggle}
        onLoadMore={handleLoadMore}
        selectedId={selectedId}
      />
    </div>
  );
}

export default TreeExplorer;
