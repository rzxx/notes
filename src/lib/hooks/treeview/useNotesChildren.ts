"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchNotesPage } from "@/lib/hooks/useTreePager";

export function useNotesChildren(parentId: string | null) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.notes.list(parentId),
    queryFn: ({ pageParam }) => fetchNotesPage(parentId, pageParam ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    select: (data) => {
      const notes = data.pages.flatMap((page) => page.notes);
      const lastPage = data.pages[data.pages.length - 1];
      return { ...data, notes, nextCursor: lastPage?.nextCursor ?? null };
    },
  });

  return query;
}
