import { create as produce } from "mutative";
import { create } from "zustand";

type EditorDraft = {
  text: string;
  dirtyAt: number;
  lastSyncedAt: number | null;
};

type EditorNoteState = {
  activeBlockId: string | null;
  draftsByBlockId: Record<string, EditorDraft>;
};

type EditorState = {
  byNoteId: Record<string, EditorNoteState>;
};

type EditorActions = {
  setActiveBlock: (noteId: string, blockId: string | null) => void;
  setDraftText: (noteId: string, blockId: string, text: string) => void;
  clearDraft: (noteId: string, blockId: string) => void;
  clearNote: (noteId: string) => void;
};

const EMPTY_NOTE_STATE: EditorNoteState = {
  activeBlockId: null,
  draftsByBlockId: {},
};

const ensureNoteState = (draft: EditorState, noteId: string) => {
  if (!draft.byNoteId[noteId]) {
    draft.byNoteId[noteId] = { activeBlockId: null, draftsByBlockId: {} };
  }
  return draft.byNoteId[noteId];
};

export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  byNoteId: {},

  setActiveBlock: (noteId, blockId) =>
    set((state) =>
      produce(state, (draft) => {
        const noteState = ensureNoteState(draft, noteId);
        noteState.activeBlockId = blockId;
      }),
    ),

  setDraftText: (noteId, blockId, text) =>
    set((state) =>
      produce(state, (draft) => {
        const noteState = ensureNoteState(draft, noteId);
        const now = Date.now();
        noteState.draftsByBlockId[blockId] = {
          text,
          dirtyAt: now,
          lastSyncedAt: noteState.draftsByBlockId[blockId]?.lastSyncedAt ?? null,
        };
      }),
    ),

  clearDraft: (noteId, blockId) =>
    set((state) =>
      produce(state, (draft) => {
        const noteState = draft.byNoteId[noteId];
        if (!noteState) return;
        delete noteState.draftsByBlockId[blockId];
      }),
    ),

  clearNote: (noteId) =>
    set((state) =>
      produce(state, (draft) => {
        delete draft.byNoteId[noteId];
      }),
    ),
}));

export type { EditorDraft, EditorNoteState, EditorState, EditorActions };

export const selectEditorNote = (noteId: string) => (state: EditorState) =>
  state.byNoteId[noteId] ?? EMPTY_NOTE_STATE;
