import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchNotesPage } from "@/lib/hooks/useTreePager";

export function usePrefetchNotesPage(parentId: string | null) {
  const queryClient = useQueryClient();

  return () =>
    queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.notes.list(parentId),
      queryFn: ({ pageParam }) => fetchNotesPage(parentId, pageParam ?? null),
      initialPageParam: null as string | null,
    });
}
