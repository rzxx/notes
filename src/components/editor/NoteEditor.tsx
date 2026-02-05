"use client";

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronDown, ChevronUp, Ellipsis, Heading, Text } from "lucide-react";
import { useNote } from "@/lib/hooks/editor/useNote";
import { useCreateBlock } from "@/lib/hooks/editor/useCreateBlock";
import { useDeleteBlock } from "@/lib/hooks/editor/useDeleteBlock";
import { useReorderBlocks } from "@/lib/hooks/editor/useReorderBlocks";
import { useUpdateBlock } from "@/lib/hooks/editor/useUpdateBlock";
import type { NoteBlock } from "@/lib/hooks/editor/types";
import { selectEditorNote, useEditorStore } from "@/lib/stores/editor";

type BlockTextContent = {
  text?: string;
};

type BlockType = "paragraph" | "heading";

const sortBlocks = (blocks: NoteBlock[]) =>
  [...blocks].sort((a, b) =>
    a.position !== b.position ? a.position - b.position : a.id.localeCompare(b.id),
  );

const getBlockText = (block: NoteBlock) => {
  if (!block.contentJson || typeof block.contentJson !== "object") return block.plainText ?? "";
  const maybe = block.contentJson as BlockTextContent;
  return typeof maybe.text === "string" ? maybe.text : (block.plainText ?? "");
};

const normalizeDraftText = (value: string) => value.replace(/\r\n/g, "\n");

const isHeading = (type: string) => type === "heading";

export function NoteEditor({ noteId }: { noteId: string }) {
  const noteQuery = useNote(noteId);
  const createBlock = useCreateBlock();
  const deleteBlock = useDeleteBlock();
  const reorderBlocks = useReorderBlocks();
  const updateBlock = useUpdateBlock();

  const { activeBlockId, draftsByBlockId } = useEditorStore(selectEditorNote(noteId));
  const setActiveBlock = useEditorStore((state) => state.setActiveBlock);
  const setDraftText = useEditorStore((state) => state.setDraftText);
  const clearDraft = useEditorStore((state) => state.clearDraft);
  const clearNote = useEditorStore((state) => state.clearNote);

  const blockRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>({});
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const [pendingFocus, setPendingFocus] = React.useState<{
    id: string;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const autoInsertedRef = React.useRef<Record<string, boolean>>({});

  const blocks = React.useMemo(() => sortBlocks(noteQuery.data?.blocks ?? []), [noteQuery.data]);

  React.useEffect(() => () => clearNote(noteId), [clearNote, noteId]);

  React.useEffect(() => {
    if (!noteQuery.data) return;
    if ((noteQuery.data.blocks?.length ?? 0) > 0) return;
    if (autoInsertedRef.current[noteId]) return;

    autoInsertedRef.current[noteId] = true;
    createBlock.mutate({
      noteId,
      type: "paragraph",
      position: 0,
      contentJson: { text: "" },
      plainText: "",
    });
  }, [createBlock, noteId, noteQuery.data]);

  React.useEffect(() => {
    if (!noteQuery.data) return;

    noteQuery.data.blocks.forEach((block) => {
      const draft = draftsByBlockId[block.id];
      if (!draft) return;
      const baseText = getBlockText(block);
      if (normalizeDraftText(draft.text) === normalizeDraftText(baseText)) {
        clearDraft(noteId, block.id);
      }
    });
  }, [clearDraft, draftsByBlockId, noteId, noteQuery.data]);

  React.useEffect(() => {
    if (!pendingFocus) return;
    const target = blockRefs.current[pendingFocus.id];
    if (!target) return;
    target.focus();
    target.setSelectionRange(pendingFocus.selectionStart, pendingFocus.selectionEnd);
    setPendingFocus(null);
  }, [pendingFocus, blocks]);

  const resizeTextarea = React.useCallback((node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  const resizeAllTextareas = React.useCallback(() => {
    blocks.forEach((block) => resizeTextarea(blockRefs.current[block.id]));
  }, [blocks, resizeTextarea]);

  React.useLayoutEffect(() => {
    resizeAllTextareas();
  }, [blocks, draftsByBlockId, resizeAllTextareas]);

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
      setActiveBlock(noteId, null);
    },
    [activeBlockId, noteId, setActiveBlock],
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
      setActiveBlock(noteId, null);
    };

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, [activeBlockId, noteId, setActiveBlock]);

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
        {blocks.map((block, index) => {
          const draft = draftsByBlockId[block.id];
          const text = draft?.text ?? getBlockText(block);
          const isActive = activeBlockId === block.id;
          const isTop = index === 0;
          const isBottom = index === blocks.length - 1;

          const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            const nextText = event.target.value;
            resizeTextarea(event.currentTarget);
            setDraftText(noteId, block.id, nextText);
            updateBlock.updateBlock({
              noteId,
              blockId: block.id,
              contentJson: { text: nextText },
              plainText: nextText,
            });
          };

          const handleBlur = () => {
            updateBlock.flush();
          };

          const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              const selectionStart = event.currentTarget.selectionStart ?? text.length;
              const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart;
              const before = text.slice(0, selectionStart);
              const after = text.slice(selectionEnd);

              setDraftText(noteId, block.id, before);
              updateBlock.updateBlock({
                noteId,
                blockId: block.id,
                contentJson: { text: before },
                plainText: before,
              });
              updateBlock.flush();

              createBlock.mutate(
                {
                  noteId,
                  type: block.type,
                  position: block.position + 1,
                  contentJson: { text: after },
                  plainText: after,
                },
                {
                  onSuccess: (data) => {
                    setActiveBlock(noteId, data.block.id);
                    setPendingFocus({
                      id: data.block.id,
                      selectionStart: 0,
                      selectionEnd: 0,
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
              const prevBlock = blocks[index - 1];
              const prevText = draftsByBlockId[prevBlock.id]?.text ?? getBlockText(prevBlock);
              const merged = `${prevText}${text}`;

              setDraftText(noteId, prevBlock.id, merged);
              updateBlock.updateBlock({
                noteId,
                blockId: prevBlock.id,
                contentJson: { text: merged },
                plainText: merged,
              });
              updateBlock.flush();

              clearDraft(noteId, block.id);
              deleteBlock.mutate({ noteId, blockId: block.id });
              setActiveBlock(noteId, prevBlock.id);
              const caretPosition = prevText.length;
              setPendingFocus({
                id: prevBlock.id,
                selectionStart: caretPosition,
                selectionEnd: caretPosition,
              });
            }
          };

          const handleTypeChange = (nextType: BlockType) => {
            if (block.type === nextType) return;
            updateBlock.updateBlock({
              noteId,
              blockId: block.id,
              type: nextType,
            });
            updateBlock.flush();
          };

          return (
            <div
              key={block.id}
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
                  onDelete={() => deleteBlock.mutate({ noteId, blockId: block.id })}
                  isBusy={deleteBlock.isPending || updateBlock.isPending}
                />
              </div>

              <textarea
                ref={(node) => {
                  blockRefs.current[block.id] = node;
                  resizeTextarea(node);
                }}
                value={text}
                onFocus={() => setActiveBlock(noteId, block.id)}
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
        })}
      </section>
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
