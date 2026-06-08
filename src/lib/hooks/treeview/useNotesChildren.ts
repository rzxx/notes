"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchNotesPage } from "@/lib/hooks/treeview/useTreePager";
import { useAuthToken } from "@/lib/auth/client";

export function useNotesChildren(parentId: string | null) {
  const { token, userId } = useAuthToken();

  const query = useInfiniteQuery({
    queryKey: [...queryKeys.notes.list(parentId), userId, token],
    queryFn: ({ pageParam }) => fetchNotesPage(parentId, pageParam ?? null, token),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled: Boolean(token),
    select: (data) => {
      const notes = data.pages.flatMap((page) => page.notes);
      const lastPage = data.pages[data.pages.length - 1];
      return { ...data, notes, nextCursor: lastPage?.nextCursor ?? null };
    },
  });

  return query;
}
