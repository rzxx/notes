"use client";

import * as React from "react";
import { selectActiveBlockId, useEditorStore } from "@/lib/stores/editor";
import { useUpdateBlock } from "@/lib/hooks/editor/useUpdateBlock";

type PendingFocus = {
  id: string;
  selectionStart: number;
  selectionEnd: number;
};

export function useEditorSession(params: {
  noteId: string;
  updateBlock: ReturnType<typeof useUpdateBlock>;
}) {
  const { noteId, updateBlock } = params;
  const activeBlockId = useEditorStore(selectActiveBlockId(noteId));

  const setActiveBlockStore = useEditorStore((state) => state.setActiveBlock);
  const setDraftTextStore = useEditorStore((state) => state.setDraftText);
  const clearDraftStore = useEditorStore((state) => state.clearDraft);
  const clearNoteStore = useEditorStore((state) => state.clearNote);

  const [pendingFocus, setPendingFocus] = React.useState<PendingFocus | null>(null);

  const setActiveBlock = React.useCallback(
    (blockId: string | null) => {
      setActiveBlockStore(noteId, blockId);
    },
    [noteId, setActiveBlockStore],
  );

  const setDraftText = React.useCallback(
    (blockId: string, text: string) => {
      setDraftTextStore(noteId, blockId, text);
    },
    [noteId, setDraftTextStore],
  );

  const clearDraft = React.useCallback(
    (blockId: string) => {
      clearDraftStore(noteId, blockId);
    },
    [clearDraftStore, noteId],
  );

  const queueFocus = React.useCallback((target: PendingFocus | null) => {
    setPendingFocus(target);
  }, []);

  const clearPendingFocus = React.useCallback(() => {
    setPendingFocus(null);
  }, []);

  const flushBlock = React.useCallback(
    (blockId: string) => {
      updateBlock.flush(blockId);
    },
    [updateBlock],
  );

  const cancelBlock = React.useCallback(
    (blockId: string) => {
      updateBlock.cancel(blockId);
    },
    [updateBlock],
  );

  React.useEffect(
    () => () => {
      updateBlock.flush();
      clearNoteStore(noteId);
    },
    [clearNoteStore, noteId, updateBlock],
  );

  return {
    activeBlockId,
    setActiveBlock,
    setDraftText,
    clearDraft,
    pendingFocus,
    queueFocus,
    clearPendingFocus,
    flushBlock,
    cancelBlock,
  };
}
