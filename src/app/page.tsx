"use client";

import * as React from "react";
import { useNotesChildren } from "@/lib/hooks/useNotesChildren";
import { useCreateNote } from "@/lib/hooks/useCreateNote";
import { useNote } from "@/lib/hooks/useNote";
import { useRenameNote } from "@/lib/hooks/useRenameNote";
import { useMoveNote } from "@/lib/hooks/useMoveNote";
import { useDeleteNote } from "@/lib/hooks/useDeleteNote";

export default function Home() {
  const [title, setTitle] = React.useState("");
  const [noteId, setNoteId] = React.useState("");
  const [renameId, setRenameId] = React.useState("");
  const [renameTitle, setRenameTitle] = React.useState("");
  const [renameParentId, setRenameParentId] = React.useState("");
  const [moveNoteId, setMoveNoteId] = React.useState("");
  const [moveFromId, setMoveFromId] = React.useState("");
  const [moveToId, setMoveToId] = React.useState("");
  const [deleteId, setDeleteId] = React.useState("");
  const [deleteParentId, setDeleteParentId] = React.useState("");
  const notesQuery = useNotesChildren(null);
  const createNote = useCreateNote();
  const noteQuery = useNote(noteId.trim() ? noteId.trim() : null);
  const renameNote = useRenameNote();
  const moveNote = useMoveNote();
  const deleteNote = useDeleteNote();

  const handleCreate = () => {
    if (!title.trim()) return;
    createNote.mutate({ parentId: null, title: title.trim() });
    setTitle("");
  };

  const handleRename = () => {
    if (!renameId.trim() || !renameTitle.trim()) return;
    const parentId = renameParentId.trim() ? renameParentId.trim() : null;
    renameNote.mutate({ noteId: renameId.trim(), title: renameTitle.trim(), parentId });
    setRenameTitle("");
  };

  const handleMove = () => {
    if (!moveNoteId.trim()) return;
    const previousParentId = moveFromId.trim() ? moveFromId.trim() : null;
    const newParentId = moveToId.trim() ? moveToId.trim() : null;
    moveNote.mutate({ noteId: moveNoteId.trim(), previousParentId, newParentId });
  };

  const handleDelete = () => {
    if (!deleteId.trim()) return;
    const parentId = deleteParentId.trim() ? deleteParentId.trim() : null;
    deleteNote.mutate({ noteId: deleteId.trim(), parentId });
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Notes demo</h1>
          <p className="text-sm text-zinc-600">Root list + create note hook example.</p>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="New note title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <button
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              onClick={handleCreate}
              disabled={createNote.isPending}
              type="button"
            >
              {createNote.isPending ? "Creating..." : "Create"}
            </button>
          </div>
          {createNote.error ? (
            <p className="mt-2 text-sm text-red-600">Failed to create note.</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Root notes
          </h2>
          {notesQuery.isLoading ? <p className="mt-3 text-sm text-zinc-500">Loading...</p> : null}
          {notesQuery.error ? (
            <p className="mt-3 text-sm text-red-600">Failed to load notes.</p>
          ) : null}
          {!notesQuery.isLoading && notesQuery.data?.notes?.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No notes yet.</p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {notesQuery.data?.notes?.map((note) => (
              <li key={note.id} className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-zinc-900">{note.title}</span>
                  {note.hasChildren ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Has children
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">{note.id}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Note detail
          </h2>
          <div className="mt-3 flex items-center gap-3">
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Paste note id"
              value={noteId}
              onChange={(event) => setNoteId(event.target.value)}
            />
          </div>
          {noteQuery.isLoading ? <p className="mt-3 text-sm text-zinc-500">Loading...</p> : null}
          {noteQuery.error ? (
            <p className="mt-3 text-sm text-red-600">Failed to load note.</p>
          ) : null}
          {noteQuery.data ? (
            <div className="mt-3 rounded-md border border-zinc-200 px-3 py-2 text-sm">
              <div className="font-medium">{noteQuery.data.note.title}</div>
              <div className="text-xs text-zinc-500">Blocks: {noteQuery.data.blocks.length}</div>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Rename note
          </h2>
          <div className="mt-3 grid gap-3">
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Note id"
              value={renameId}
              onChange={(event) => setRenameId(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="New title"
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Parent id (blank = root)"
              value={renameParentId}
              onChange={(event) => setRenameParentId(event.target.value)}
            />
          </div>
          <button
            className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            onClick={handleRename}
            disabled={renameNote.isPending}
            type="button"
          >
            {renameNote.isPending ? "Renaming..." : "Rename"}
          </button>
          {renameNote.error ? (
            <p className="mt-2 text-sm text-red-600">Failed to rename note.</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">Move note</h2>
          <div className="mt-3 grid gap-3">
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Note id"
              value={moveNoteId}
              onChange={(event) => setMoveNoteId(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Previous parent id (blank = root)"
              value={moveFromId}
              onChange={(event) => setMoveFromId(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="New parent id (blank = root)"
              value={moveToId}
              onChange={(event) => setMoveToId(event.target.value)}
            />
          </div>
          <button
            className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            onClick={handleMove}
            disabled={moveNote.isPending}
            type="button"
          >
            {moveNote.isPending ? "Moving..." : "Move"}
          </button>
          {moveNote.error ? (
            <p className="mt-2 text-sm text-red-600">Failed to move note.</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Delete note
          </h2>
          <div className="mt-3 grid gap-3">
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Note id"
              value={deleteId}
              onChange={(event) => setDeleteId(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Parent id (blank = root)"
              value={deleteParentId}
              onChange={(event) => setDeleteParentId(event.target.value)}
            />
          </div>
          <button
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
            onClick={handleDelete}
            disabled={deleteNote.isPending}
            type="button"
          >
            {deleteNote.isPending ? "Deleting..." : "Delete"}
          </button>
          {deleteNote.error ? (
            <p className="mt-2 text-sm text-red-600">Failed to delete note.</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
