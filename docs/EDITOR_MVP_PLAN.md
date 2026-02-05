# Editor MVP Plan (Flat Blocks)

## Goal

Ship a first editor that can load, edit, and reorder flat blocks (paragraph/heading) with debounced autosave and optimistic updates.

## Current Baseline

- Notes tree, selection, and note detail fetch are working.
- DB has `blocks` with `position`, `contentJson`, and `plainText`.
- API returns note + blocks.
- Server-side block CRUD + reorder are implemented in `src/lib/db/blocks.ts`.
- Block API routes exist at `src/app/api/blocks/route.ts`, `src/app/api/blocks/[id]/route.ts`, and `src/app/api/blocks/reorder/route.ts`.

## V1 Data Rules

- Block types: start with `paragraph` and `heading` (others can be allowed but unused).
- `contentJson: { text: string }`, `plainText = text`.
- Positions are contiguous `0..n-1` per note.

## Build Steps

1. Server block operations
   - Implemented in `src/lib/db/blocks.ts` with `createBlock`, `updateBlock`, `deleteBlock`, `reorderBlocks`.
   - Uses transactions + AppError/Result patterns.

2. Block API routes
   - `POST /api/blocks` create block.
   - `PUT /api/blocks/:id` update block.
   - `DELETE /api/blocks/:id` delete block.
   - `PUT /api/blocks/reorder` reorder blocks by ordered ids.
   - Implemented with `safeJsonParse`, `safeParseToResult`, and `appErrorToHttp` for consistent errors.

3. Client hooks
   - Implemented in `src/lib/hooks/editor/`:
     - `useCreateBlock`, `useUpdateBlock`, `useDeleteBlock`, `useReorderBlocks`.
     - Shared types in `src/lib/hooks/editor/types.ts` (used by `useNote`).
   - Optimistically update `queryKeys.notes.detail(noteId)` and normalize positions.
   - `useUpdateBlock` merges server response into the cache on success (no invalidate).
   - `useUpdateBlock` uses a debounced `updateBlock` plus `flush()` for blur/enter.

4. Editor UI
   - Replaced the note page placeholder with a client editor (`src/components/editor/NoteEditor.tsx`).
   - Renders flat blocks with `<textarea>` inputs, debounced updates, Enter split, Backspace merge.
   - Added up/down buttons for reorder (drag later).
   - Uses Base UI Menu for block actions and Dialog for delete confirmation.

## Zustand Store Ideas (Editor)

- Keep server state (blocks list) in TanStack Query; keep only UI state in Zustand.
- Implemented `src/lib/stores/editor.ts` with `byNoteId[noteId] = { activeBlockId, draftsByBlockId }`.
- Drafts are stored per block as `{ text, dirtyAt, lastSyncedAt }`.
- Actions implemented: `setActiveBlock`, `setDraftText`, `clearDraft`, `clearNote`.

## Optional Safety Rails

- If note has zero blocks, auto-insert one empty paragraph on load. (Implemented in `NoteEditor`.)
- Keep update and reorder operations idempotent to support retries.

## Important Notes

- `BLOCK_NOT_FOUND` AppError was added; map it using `appErrorToHttp` like other errors.
- Block operations keep positions contiguous and resolve conflicts:
  - Create shifts positions >= insert point.
  - Delete compacts positions > deleted position.
  - Reorder validates full coverage and uses a temporary offset to avoid unique collisions.
- Reorder expects `orderedBlockIds` to include all blocks for the note; partial lists are rejected.
- Client hooks create temp IDs on optimistic insert and replace on success.
