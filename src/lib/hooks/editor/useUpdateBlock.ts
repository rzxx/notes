"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteBlock, NoteDetailResponse } from "@/lib/hooks/editor/types";

type UpdateBlockInput = {
  noteId: string;
  blockId: string;
  type?: string;
  contentJson?: unknown;
  plainText?: string;
};

type UpdateBlockResponse = {
  ok: true;
  block: NoteBlock;
};

type UseUpdateBlockOptions = {
  debounceMs?: number;
};

async function updateBlock(input: UpdateBlockInput) {
  const result = await fetchResult<UpdateBlockResponse>(`/api/blocks/${input.blockId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: input.type,
      contentJson: input.contentJson,
      plainText: input.plainText,
    }),
  });

  if (!result.ok) throw result.error;
  return result.value;
}

export function useUpdateBlock(options?: UseUpdateBlockOptions) {
  const queryClient = useQueryClient();
  const debounceMs = options?.debounceMs ?? 350;
  const timeoutRef = useRef<number | null>(null);
  const pendingRef = useRef<UpdateBlockInput | null>(null);

  const mutation = useMutation({
    mutationFn: updateBlock,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });

      const key = queryKeys.notes.detail(variables.noteId);
      const previous = queryClient.getQueryData<NoteDetailResponse>(key);
      if (!previous) return { previous: null } as const;

      const blocks = previous.blocks.map((block) =>
        block.id === variables.blockId
          ? {
              ...block,
              type: variables.type ?? block.type,
              contentJson: variables.contentJson ?? block.contentJson,
              plainText: variables.plainText ?? block.plainText,
              updatedAt: new Date().toISOString(),
            }
          : block,
      );

      queryClient.setQueryData<NoteDetailResponse>(key, { ...previous, blocks });
      return { previous } as const;
    },
    onError: (_error, variables, context) => {
      if (!context?.previous) return;
      queryClient.setQueryData(queryKeys.notes.detail(variables.noteId), context.previous);
    },
    onSuccess: (data, variables) => {
      const key = queryKeys.notes.detail(variables.noteId);
      queryClient.setQueryData<NoteDetailResponse>(key, (current) => {
        if (!current) return current;
        const blocks = current.blocks.map((block) =>
          block.id === data.block.id ? data.block : block,
        );
        return { ...current, blocks };
      });
    },
  });

  const { mutate } = mutation;

  const updateBlockDebounced = useCallback(
    (input: UpdateBlockInput) => {
      pendingRef.current = input;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        const payload = pendingRef.current;
        pendingRef.current = null;
        if (payload) mutate(payload);
      }, debounceMs);
    },
    [debounceMs, mutate],
  );

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const payload = pendingRef.current;
    pendingRef.current = null;
    if (payload) mutate(payload);
  }, [mutate]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return {
    ...mutation,
    updateBlock: updateBlockDebounced,
    flush,
    cancel,
  };
}
