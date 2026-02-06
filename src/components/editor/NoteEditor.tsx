"use client";

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, ChevronUp, Ellipsis, Heading, Text } from "lucide-react";
import { useNote } from "@/lib/hooks/editor/useNote";
import { useCreateBlock } from "@/lib/hooks/editor/useCreateBlock";
import { useDeleteBlock } from "@/lib/hooks/editor/useDeleteBlock";
import { useMergeBlocks } from "@/lib/hooks/editor/useMergeBlocks";
import { useReorderBlocks } from "@/lib/hooks/editor/useReorderBlocks";
import { makeTempId as makeSplitTempId, useSplitBlock } from "@/lib/hooks/editor/useSplitBlock";
import { useEditorSession } from "@/lib/hooks/editor/useEditorSession";
import { useUpdateBlock } from "@/lib/hooks/editor/useUpdateBlock";
import type { NoteBlock } from "@/lib/hooks/editor/types";
import { getBlockTextFromContent, type BlockType } from "@/lib/editor/block-content";
import { sortBlocks } from "@/lib/editor/block-list";
import { selectDraftForBlock, useEditorStore } from "@/lib/stores/editor";

const getBlockText = (block: NoteBlock) =>
  getBlockTextFromContent({
    type: block.type,
    contentJson: block.contentJson,
    plainText: block.plainText,
  });

const normalizeDraftText = (value: string) => value.replace(/\r\n/g, "\n");

const isHeading = (type: string) => type === "heading";

export function NoteEditor({ noteId }: { noteId: string }) {
  const noteQuery = useNote(noteId);
  const createBlock = useCreateBlock();
  const deleteBlock = useDeleteBlock();
  const mergeBlocks = useMergeBlocks();
  const reorderBlocks = useReorderBlocks();
  const splitBlock = useSplitBlock();
  const updateBlock = useUpdateBlock();

  const {
    activeBlockId,
    setActiveBlock,
    setDraftText,
    clearDraft,
    pendingFocus,
    queueFocus,
    clearPendingFocus,
    flushBlock,
    cancelBlock,
  } = useEditorSession({ noteId, updateBlock });

  const blockRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>({});
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const autoInsertStateRef = React.useRef<Record<string, "idle" | "pending" | "succeeded">>({});

  const blocks = React.useMemo(() => sortBlocks(noteQuery.data?.blocks ?? []), [noteQuery.data]);

  const getBlockSelection = React.useCallback((blockId: string) => {
    const node = blockRefs.current[blockId];
    if (!node) return null;
    const selectionStart = node.selectionStart ?? 0;
    const selectionEnd = node.selectionEnd ?? selectionStart;
    return { selectionStart, selectionEnd };
  }, []);

  React.useEffect(() => {
    if (!noteQuery.data) return;
    if ((noteQuery.data.blocks?.length ?? 0) > 0) return;
    const autoInsertState = autoInsertStateRef.current[noteId] ?? "idle";
    if (autoInsertState === "pending" || autoInsertState === "succeeded") return;

    autoInsertStateRef.current[noteId] = "pending";
    createBlock.mutate(
      {
        noteId,
        type: "paragraph",
        position: 0,
        contentJson: { text: "" },
        plainText: "",
      },
      {
        onSuccess: (data, _variables, context) => {
          autoInsertStateRef.current[noteId] = "succeeded";
          if (!context?.tempId) return;
          updateBlock.promoteTempId(noteId, context.tempId, data.block.id);
        },
        onError: () => {
          autoInsertStateRef.current[noteId] = "idle";
        },
      },
    );
  }, [createBlock, noteId, noteQuery.data, updateBlock]);

  React.useEffect(() => {
    if (!pendingFocus) return;
    const target = blockRefs.current[pendingFocus.id];
    if (!target) return;
    target.focus();
    target.setSelectionRange(pendingFocus.selectionStart, pendingFocus.selectionEnd);
    clearPendingFocus();
  }, [clearPendingFocus, pendingFocus, blocks]);

  const resizeTextarea = React.useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  const setBlockRef = React.useCallback(
    (blockId: string, node: HTMLTextAreaElement | null) => {
      blockRefs.current[blockId] = node;
      resizeTextarea(node);
    },
    [resizeTextarea],
  );

  const resizeAllTextareas = React.useCallback(() => {
    blocks.forEach((block) => resizeTextarea(blockRefs.current[block.id]));
  }, [blocks, resizeTextarea]);

  React.useLayoutEffect(() => {
    resizeAllTextareas();
  }, [blocks, resizeAllTextareas]);

  React.useEffect(() => {
    const handleResize = () => resizeAllTextareas();
    window.addEventListener("resize", handleResize);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver(() => resizeAllTextareas());
    if (editorRef.current) observer.observe(editorRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [resizeAllTextareas]);

  const handleBackgroundMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-editor-block='true']")) return;
      const active = activeBlockId ? blockRefs.current[activeBlockId] : null;
      active?.blur();
      setActiveBlock(null);
    },
    [activeBlockId, setActiveBlock],
  );

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (editorRef.current?.contains(target)) return;
      if (target.closest("[data-editor-surface='true']")) return;
      if (!activeBlockId) return;
      const active = blockRefs.current[activeBlockId];
      active?.blur();
      setActiveBlock(null);
    };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, [activeBlockId, setActiveBlock]);

  const handleDeleteBlock = React.useCallback(
    (blockId: string) => {
      const deletedIndex = blocks.findIndex((block) => block.id === blockId);
      const fallbackBlock =
        deletedIndex >= 0 ? (blocks[deletedIndex + 1] ?? blocks[deletedIndex - 1] ?? null) : null;
      const fallbackBlockId = fallbackBlock?.id ?? null;
      const currentActiveId = useEditorStore.getState().byNoteId[noteId]?.activeBlockId ?? null;
      const wasActiveBlock = currentActiveId === blockId;

      if (wasActiveBlock) {
        setActiveBlock(fallbackBlockId);
        if (fallbackBlockId) {
          queueFocus({ id: fallbackBlockId, selectionStart: 0, selectionEnd: 0 });
        }
      }

      deleteBlock.mutate(
        { noteId, blockId },
        {
          onError: () => {
            if (!wasActiveBlock) return;
            setActiveBlock(blockId);
            queueFocus({ id: blockId, selectionStart: 0, selectionEnd: 0 });
          },
        },
      );
    },
    [blocks, deleteBlock, noteId, queueFocus, setActiveBlock],
  );

  const handleMove = React.useCallback(
    (blockId: string, direction: "up" | "down") => {
      if (!blocks.length) return;
      const index = blocks.findIndex((block) => block.id === blockId);
      if (index < 0) return;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= blocks.length) return;

      const orderedBlockIds = blocks.map((block) => block.id);
      const temp = orderedBlockIds[index];
      orderedBlockIds[index] = orderedBlockIds[nextIndex];
      orderedBlockIds[nextIndex] = temp;

      reorderBlocks.mutate({ noteId, orderedBlockIds });
    },
    [blocks, noteId, reorderBlocks],
  );

  if (noteQuery.isLoading) {
    return <div className="text-sm text-stone-500">Loading note...</div>;
  }

  if (noteQuery.error) {
    return <div className="text-sm text-red-600">Failed to load note.</div>;
  }

  if (!noteQuery.data) {
    return <div className="text-sm text-stone-500">Note not found.</div>;
  }

  return (
    <div
      ref={editorRef}
      data-editor-surface="true"
      className="space-y-4"
      onMouseDown={handleBackgroundMouseDown}
    >
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-stone-900">{noteQuery.data.note.title}</h1>
        <p className="text-xs text-stone-500">{noteQuery.data.note.id}</p>
      </header>

      <section className="space-y-3">
        {blocks.map((block, index) => (
          <EditorBlock
            key={block.id}
            noteId={noteId}
            block={block}
            prevBlock={index > 0 ? blocks[index - 1] : null}
            index={index}
            total={blocks.length}
            isActive={activeBlockId === block.id}
            resizeTextarea={resizeTextarea}
            setBlockRef={setBlockRef}
            setActiveBlock={setActiveBlock}
            setDraftText={setDraftText}
            clearDraft={clearDraft}
            setPendingFocus={queueFocus}
            getBlockSelection={getBlockSelection}
            updateBlock={updateBlock}
            splitBlock={splitBlock}
            mergeBlocks={mergeBlocks}
            deleteBlock={deleteBlock}
            onDeleteBlock={handleDeleteBlock}
            reorderBlocks={reorderBlocks}
            flushBlock={flushBlock}
            cancelBlock={cancelBlock}
            handleMove={handleMove}
          />
        ))}
      </section>
    </div>
  );
}

type EditorBlockProps = {
  noteId: string;
  block: NoteBlock;
  prevBlock: NoteBlock | null;
  index: number;
  total: number;
  isActive: boolean;
  resizeTextarea: (node: HTMLTextAreaElement | null) => void;
  setBlockRef: (blockId: string, node: HTMLTextAreaElement | null) => void;
  setActiveBlock: (blockId: string | null) => void;
  setDraftText: (blockId: string, text: string) => void;
  clearDraft: (blockId: string) => void;
  setPendingFocus: (
    target: { id: string; selectionStart: number; selectionEnd: number } | null,
  ) => void;
  getBlockSelection: (blockId: string) => { selectionStart: number; selectionEnd: number } | null;
  updateBlock: ReturnType<typeof useUpdateBlock>;
  splitBlock: ReturnType<typeof useSplitBlock>;
  mergeBlocks: ReturnType<typeof useMergeBlocks>;
  deleteBlock: ReturnType<typeof useDeleteBlock>;
  onDeleteBlock: (blockId: string) => void;
  reorderBlocks: ReturnType<typeof useReorderBlocks>;
  flushBlock: (blockId: string) => void;
  cancelBlock: (blockId: string) => void;
  handleMove: (blockId: string, direction: "up" | "down") => void;
};

function EditorBlock({
  noteId,
  block,
  prevBlock,
  index,
  total,
  isActive,
  resizeTextarea,
  setBlockRef,
  setActiveBlock,
  setDraftText,
  clearDraft,
  setPendingFocus,
  getBlockSelection,
  updateBlock,
  splitBlock,
  mergeBlocks,
  deleteBlock,
  onDeleteBlock,
  reorderBlocks,
  flushBlock,
  cancelBlock,
  handleMove,
}: EditorBlockProps) {
  const draft = useEditorStore(selectDraftForBlock(noteId, block.id));
  const text = draft?.text ?? getBlockText(block);
  const isTop = index === 0;
  const isBottom = index === total - 1;

  React.useEffect(() => {
    if (!draft) return;
    const baseText = getBlockText(block);
    if (normalizeDraftText(draft.text) === normalizeDraftText(baseText)) {
      clearDraft(block.id);
    }
  }, [block, clearDraft, draft, noteId]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value;
    resizeTextarea(event.currentTarget);
    setDraftText(block.id, nextText);
    updateBlock.updateBlock({
      noteId,
      blockId: block.id,
      contentJson: { text: nextText },
      plainText: nextText,
    });
  };

  const handleBlur = () => {
    flushBlock(block.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const originalText = text;
      const selectionStart = event.currentTarget.selectionStart ?? text.length;
      const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
      const before = text.slice(0, selectionStart);
      const after = text.slice(selectionEnd);

      cancelBlock(block.id);
      setDraftText(block.id, before);
      const tempId = makeSplitTempId();
      setActiveBlock(tempId);
      setPendingFocus({
        id: tempId,
        selectionStart: 0,
        selectionEnd: 0,
      });
      splitBlock.mutate(
        {
          noteId,
          blockId: block.id,
          beforeText: before,
          afterText: after,
          tempId,
        },
        {
          onSuccess: (data, _variables, context) => {
            const selection = context?.tempId ? getBlockSelection(context.tempId) : null;
            if (context?.tempId) {
              updateBlock.promoteTempId(noteId, context.tempId, data.newBlock.id);
            }
            setActiveBlock(data.newBlock.id);
            setPendingFocus({
              id: data.newBlock.id,
              selectionStart: selection?.selectionStart ?? 0,
              selectionEnd: selection?.selectionEnd ?? 0,
            });
          },
          onError: () => {
            setDraftText(block.id, originalText);
            setActiveBlock(block.id);
            setPendingFocus({
              id: block.id,
              selectionStart,
              selectionEnd: selectionStart,
            });
          },
        },
      );
      return;
    }

    if (event.key === "Backspace") {
      const selectionStart = event.currentTarget.selectionStart ?? 0;
      const selectionEnd = event.currentTarget.selectionEnd ?? 0;
      if (selectionStart !== 0 || selectionEnd !== 0) return;
      if (index === 0) return;

      event.preventDefault();
      if (!prevBlock) return;
      const prevDraft = useEditorStore.getState().byNoteId[noteId]?.draftsByBlockId[prevBlock.id];
      const prevText = prevDraft?.text ?? getBlockText(prevBlock);
      const currentText = text;
      const merged = `${prevText}${currentText}`;

      cancelBlock(prevBlock.id);
      cancelBlock(block.id);
      setDraftText(prevBlock.id, merged);
      mergeBlocks.mutate(
        {
          noteId,
          prevBlockId: prevBlock.id,
          currentBlockId: block.id,
          mergedText: merged,
        },
        {
          onSuccess: () => {
            clearDraft(block.id);
            setActiveBlock(prevBlock.id);
            const caretPosition = prevText.length;
            setPendingFocus({
              id: prevBlock.id,
              selectionStart: caretPosition,
              selectionEnd: caretPosition,
            });
          },
          onError: () => {
            setDraftText(prevBlock.id, prevText);
            setDraftText(block.id, currentText);
            setActiveBlock(block.id);
            setPendingFocus({
              id: block.id,
              selectionStart: 0,
              selectionEnd: 0,
            });
          },
        },
      );
    }
  };

  const handleTypeChange = (nextType: BlockType) => {
    if (block.type === nextType) return;
    updateBlock.updateBlock({
      noteId,
      blockId: block.id,
      type: nextType,
    });
    flushBlock(block.id);
  };

  return (
    <div
      data-editor-block="true"
      className={`group relative rounded-lg border px-3 py-2 transition-colors ${
        isActive
          ? "border-stone-400 bg-white shadow-xs"
          : "border-transparent hover:border-stone-200"
      }`}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => handleMove(block.id, "up")}
          disabled={isTop || reorderBlocks.isPending}
          aria-label="Move block up"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => handleMove(block.id, "down")}
          disabled={isBottom || reorderBlocks.isPending}
          aria-label="Move block down"
        >
          <ChevronDown size={14} />
        </button>
        <BlockActions
          block={block}
          onChangeType={handleTypeChange}
          onDelete={() => onDeleteBlock(block.id)}
          isBusy={
            deleteBlock.isPending ||
            updateBlock.isPending ||
            splitBlock.isPending ||
            mergeBlocks.isPending
          }
        />
      </div>

      <textarea
        ref={(node) => {
          setBlockRef(block.id, node);
        }}
        value={text}
        onFocus={() => setActiveBlock(block.id)}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={block.type === "heading" ? "Heading" : "Write something..."}
        rows={1}
        className={`w-full resize-none bg-transparent text-stone-900 transition-colors outline-none ${
          isHeading(block.type) ? "text-lg font-semibold" : "text-sm leading-6"
        }`}
      />
    </div>
  );
}

function BlockActions({
  block,
  onChangeType,
  onDelete,
  isBusy,
}: {
  block: NoteBlock;
  onChangeType: (nextType: BlockType) => void;
  onDelete: () => void;
  isBusy: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger className="flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700">
          <Ellipsis size={14} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={10} side="right">
            <Menu.Popup
              data-editor-surface="true"
              className="starting-or-ending:opacity-0 starting-or-ending:-translate-x-2 starting-or-ending:scale-95 rounded-lg border border-stone-200 bg-stone-50 p-2 shadow-lg transition-[opacity,translate,scale] duration-150 ease-in-out"
            >
              <div className="mb-1 px-2 py-1 text-xs font-medium text-stone-500">Block</div>
              <Menu.Item
                onClick={() => onChangeType("paragraph")}
                disabled={isBusy || block.type === "paragraph"}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-stone-700 transition-colors hover:cursor-pointer hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Text size={16} />
                <span>Paragraph</span>
              </Menu.Item>
              <Menu.Item
                onClick={() => onChangeType("heading")}
                disabled={isBusy || block.type === "heading"}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-stone-700 transition-colors hover:cursor-pointer hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Heading size={16} />
                <span>Heading</span>
              </Menu.Item>
              <Menu.Item
                onClick={() => setDeleteOpen(true)}
                disabled={isBusy}
                className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-700 transition-colors hover:cursor-pointer hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>Delete</span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="starting-or-ending:opacity-0 fixed inset-0 bg-black/25 opacity-100 backdrop-blur-xs transition-opacity duration-150 ease-in-out" />
          <Dialog.Popup
            data-editor-surface="true"
            className="starting-or-ending:opacity-0 starting-or-ending:scale-95 fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-stone-200 bg-stone-50 p-6 shadow-xl transition-[scale,opacity] duration-150 ease-out"
          >
            <Dialog.Title className="mb-2 text-lg font-semibold text-stone-800">
              Delete block?
            </Dialog.Title>
            <Dialog.Description className="mb-6 text-sm text-stone-600">
              This action cannot be undone.
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <Dialog.Close className="cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50">
                Cancel
              </Dialog.Close>
              <button
                onClick={() => {
                  onDelete();
                  setDeleteOpen(false);
                }}
                className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                disabled={isBusy}
              >
                Delete
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
