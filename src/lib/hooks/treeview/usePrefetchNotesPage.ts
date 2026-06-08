import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchNotesPage } from "@/lib/hooks/treeview/useTreePager";
import { useAuthToken } from "@/lib/auth/client";

export function usePrefetchNotesPage(parentId: string | null) {
  const queryClient = useQueryClient();
  const { token, userId } = useAuthToken();

  return () =>
    queryClient.prefetchInfiniteQuery({
      queryKey: [...queryKeys.notes.list(parentId), userId, token],
      queryFn: ({ pageParam }) => fetchNotesPage(parentId, pageParam ?? null, token),
      initialPageParam: null as string | null,
    });
}
