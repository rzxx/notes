"use client";

import { Plus } from "lucide-react";
import { useCreateNote } from "@/lib/hooks/mutations/useCreateNote";

export function TreeHeaderActions() {
  const createNote = useCreateNote();

  const handleCreateRootNote = () => {
    createNote.mutate({ parentId: null, title: "Untitled note" });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Create root note"
        onClick={handleCreateRootNote}
        disabled={createNote.isPending}
        className="rounded-md border border-stone-200 bg-stone-50 p-0.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
