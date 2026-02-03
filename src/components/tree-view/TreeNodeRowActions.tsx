"use client";

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { Dialog } from "@base-ui/react/dialog";
import { Ellipsis, Trash, Info, Pencil, Plus } from "lucide-react";
import type { Note } from "@/lib/stores/tree";
import { useRenameNote } from "@/lib/hooks/mutations/useRenameNote";
import { useCreateNote } from "@/lib/hooks/mutations/useCreateNote";

function formatDate(dateString: string): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString();
}

export function TreeNodeRowActions({
  node,
  onDelete,
  isDragging = false,
  showDebugInfo = false,
}: {
  node: Note;
  onDelete: () => void;
  isDragging?: boolean;
  showDebugInfo?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");
  const menuActionsRef = React.useRef<Menu.Root.Actions | null>(null);
  const renameNote = useRenameNote();
  const createNote = useCreateNote();

  React.useEffect(() => {
    if (isDragging) {
      menuActionsRef.current?.close();
    }
  }, [isDragging]);

  const handleDeleteClick = () => {
    setDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setDialogOpen(false);
  };

  const handleRenameClick = () => {
    setRenameValue(node.title);
    setRenameDialogOpen(true);
  };

  const handleCreateChildNote = () => {
    menuActionsRef.current?.close();
    createNote.mutate({ parentId: node.id, title: "Untitled note" });
  };

  const handleRenameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = renameValue.trim().replace(/\s+/g, " ");
    const currentTitle = node.title.trim().replace(/\s+/g, " ");
    if (!nextTitle || nextTitle === currentTitle) return;
    renameNote.mutate(
      { noteId: node.id, title: nextTitle, parentId: node.parentId ?? null },
      {
        onSuccess: () => {
          setRenameDialogOpen(false);
          setRenameValue("");
        },
      },
    );
  };

  return (
    <>
      <Menu.Root actionsRef={menuActionsRef}>
        <Menu.Trigger className="absolute right-0 mr-2 opacity-0 transition-opacity group-hover:opacity-100 hover:cursor-pointer">
          <Ellipsis size={24} strokeWidth={1.5} className="text-stone-500" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={16} side="right">
            <Menu.Popup className="starting-or-ending:opacity-0 starting-or-ending:-translate-x-8 starting-or-ending:scale-y-0 rounded-lg border border-stone-200 bg-stone-50 p-2 shadow-lg transition-[opacity,translate,scale] duration-150 ease-in-out">
              {/* Metadata Section */}
              <div className="mb-2 border-b border-stone-200 pb-2">
                <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-stone-600">
                  <Info size={14} />
                  <span className="line-clamp-1">{node.title}</span>
                </div>
                <div className="px-2 py-1 text-xs text-stone-500">
                  <div>Created: {formatDate(node.createdAt)}</div>
                  {node.updatedAt && <div>Updated: {formatDate(node.updatedAt)}</div>}
                </div>
              </div>

              {/* Debug Info (optional) */}
              {showDebugInfo && (
                <div className="mb-2 border-b border-stone-200 pb-2">
                  <div className="px-2 py-1 text-xs text-stone-400">
                    <div>ID: {node.id}</div>
                    <div>Rank: {node.rank}</div>
                  </div>
                </div>
              )}

              {/* Create Note Action */}
              <Menu.Item
                onClick={handleCreateChildNote}
                disabled={createNote.isPending}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-stone-700 transition-colors hover:cursor-pointer hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} />
                <span>Add note inside</span>
              </Menu.Item>
              {/* Rename Action */}
              <Menu.Item
                onClick={handleRenameClick}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-stone-700 transition-colors hover:cursor-pointer hover:bg-stone-100"
              >
                <Pencil size={18} />
                <span>Rename note</span>
              </Menu.Item>

              {/* Delete Action */}
              <Menu.Item
                onClick={handleDeleteClick}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-700 transition-colors hover:cursor-pointer hover:bg-red-50"
              >
                <Trash size={18} />
                <span>Delete note</span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Rename Dialog */}
      <Dialog.Root
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) {
            setRenameValue("");
          } else {
            setRenameValue(node.title);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="starting-or-ending:opacity-0 fixed inset-0 bg-black/25 opacity-100 backdrop-blur-xs transition-opacity duration-150 ease-in-out" />
          <Dialog.Popup className="starting-or-ending:opacity-0 starting-or-ending:scale-75 starting-or-ending:-translate-y-1/3 fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 scale-100 rounded-lg border border-stone-200 bg-stone-50 p-6 opacity-100 shadow-xl transition-[scale,opacity,translate] duration-150 ease-out">
            <Dialog.Title className="mb-2 text-lg font-semibold text-stone-800">
              Rename note
            </Dialog.Title>
            <Dialog.Description className="mb-4 text-sm text-stone-600">
              Enter a new name for &quot;{node.title}&quot;.
            </Dialog.Description>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <input
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 shadow-xs transition-colors outline-none focus:border-stone-400"
                placeholder={node.title}
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                autoFocus
                type="text"
              />
              {renameNote.error ? (
                <p className="text-sm text-red-600">Failed to rename note.</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Dialog.Close className="cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50">
                  Cancel
                </Dialog.Close>
                <button
                  className="cursor-pointer rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={
                    renameNote.isPending ||
                    !renameValue.trim() ||
                    renameValue.trim().replace(/\s+/g, " ") ===
                      node.title.trim().replace(/\s+/g, " ")
                  }
                >
                  {renameNote.isPending ? "Renaming..." : "Rename"}
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="starting-or-ending:opacity-0 fixed inset-0 bg-black/25 opacity-100 backdrop-blur-xs transition-opacity duration-150 ease-in-out" />
          <Dialog.Popup className="starting-or-ending:opacity-0 starting-or-ending:scale-75 starting-or-ending:-translate-y-1/3 fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 scale-100 rounded-lg border border-stone-200 bg-stone-50 p-6 opacity-100 shadow-xl transition-[scale,opacity,translate] duration-150 ease-out">
            <Dialog.Title className="mb-2 text-lg font-semibold text-stone-800">
              Delete note?
            </Dialog.Title>
            <Dialog.Description className="mb-6 text-sm text-stone-600">
              Are you sure you want to delete &quot;{node.title}&quot;? This action cannot be
              undone.
            </Dialog.Description>
            <div className="flex justify-end gap-2">
              <Dialog.Close className="cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleConfirmDelete}
                className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
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
