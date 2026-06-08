"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteDetailResponse } from "@/lib/hooks/editor/types";
import { authHeaders } from "@/lib/auth/client";
import { useAuthToken } from "@/lib/auth/client";

export function useNote(noteId: string | null) {
  const { token, userId } = useAuthToken();

  return useQuery({
    queryKey: [...queryKeys.notes.detail(noteId), userId, token],
    queryFn: async () => {
      const result = await fetchResult<NoteDetailResponse>(`/api/notes/${noteId}`, {
        method: "GET",
        headers: authHeaders(token),
      });

      if (!result.ok) throw result.error;
      return result.value;
    },
    enabled: Boolean(noteId && token),
  });
}
