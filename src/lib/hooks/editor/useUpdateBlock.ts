"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { NoteBlock, NoteDetailResponse } from "@/lib/hooks/editor/types";
import { useEditorStore } from "@/lib/stores/editor";

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
  const timeoutRef = useRef(new Map<string, number>());
  const pendingRef = useRef(new Map<string, UpdateBlockInput>());
  const tempMapRef = useRef(new Map<string, string>());

  const isTempId = (id: string) => id.startsWith("temp-");
  const resolveBlockId = (id: string) => tempMapRef.current.get(id) ?? id;

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
      const resolvedId = resolveBlockId(input.blockId);
      if (isTempId(resolvedId)) {
        pendingRef.current.set(input.blockId, input);
        return;
      }

      const payload = resolvedId === input.blockId ? input : { ...input, blockId: resolvedId };
      pendingRef.current.set(payload.blockId, payload);
      const existing = timeoutRef.current.get(payload.blockId);
      if (existing) window.clearTimeout(existing);
      const timeoutId = window.setTimeout(() => {
        const pending = pendingRef.current.get(payload.blockId);
        pendingRef.current.delete(payload.blockId);
        timeoutRef.current.delete(payload.blockId);
        if (!pending) return;
        if (isTempId(resolveBlockId(pending.blockId))) {
          pendingRef.current.set(pending.blockId, pending);
          return;
        }
        mutate({ ...pending, blockId: resolveBlockId(pending.blockId) });
      }, debounceMs);
      timeoutRef.current.set(payload.blockId, timeoutId);
    },
    [debounceMs, mutate],
  );

  const flush = useCallback(
    (blockId?: string) => {
      if (blockId) {
        const resolvedId = resolveBlockId(blockId);
        if (isTempId(resolvedId)) return;
        const timeoutId = timeoutRef.current.get(resolvedId);
        if (timeoutId) window.clearTimeout(timeoutId);
        timeoutRef.current.delete(resolvedId);
        const payload = pendingRef.current.get(resolvedId);
        pendingRef.current.delete(resolvedId);
        if (payload) mutate(payload);
        return;
      }

      for (const timeoutId of timeoutRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutRef.current.clear();
      for (const payload of pendingRef.current.values()) {
        if (!isTempId(resolveBlockId(payload.blockId))) {
          mutate({ ...payload, blockId: resolveBlockId(payload.blockId) });
        }
      }
      pendingRef.current.clear();
    },
    [mutate],
  );

  const cancel = useCallback((blockId?: string) => {
    if (blockId) {
      const resolvedId = resolveBlockId(blockId);
      const timeoutId = timeoutRef.current.get(resolvedId);
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutRef.current.delete(resolvedId);
      pendingRef.current.delete(blockId);
      pendingRef.current.delete(resolvedId);
      return;
    }

    for (const timeoutId of timeoutRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    timeoutRef.current.clear();
    pendingRef.current.clear();
  }, []);

  useEffect(
    () => () => {
      for (const timeoutId of timeoutRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutRef.current.clear();
      pendingRef.current.clear();
    },
    [],
  );

  const promoteTempId = useCallback(
    (noteId: string, tempId: string, nextId: string) => {
      tempMapRef.current.set(tempId, nextId);
      const state = useEditorStore.getState();
      const draft = state.byNoteId[noteId]?.draftsByBlockId[tempId];
      const pending = pendingRef.current.get(tempId);
      pendingRef.current.delete(tempId);

      if (draft) {
        state.setDraftText(noteId, nextId, draft.text);
        state.clearDraft(noteId, tempId);
      }

      const payload = pending
        ? { ...pending, blockId: nextId }
        : draft
          ? {
              noteId,
              blockId: nextId,
              contentJson: { text: draft.text },
              plainText: draft.text,
            }
          : null;

      if (payload) mutate(payload);
    },
    [mutate],
  );

  return {
    ...mutation,
    updateBlock: updateBlockDebounced,
    flush,
    cancel,
    promoteTempId,
  };
}
