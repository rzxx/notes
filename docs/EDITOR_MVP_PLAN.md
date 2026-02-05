# Editor MVP Plan (Flat Blocks)

## Goal

Ship a first editor that can load, edit, and reorder flat blocks (paragraph/heading) with debounced autosave and optimistic updates.

## Current Baseline

- Notes tree, selection, and note detail fetch are working.
- DB has `blocks` with `position`, `contentJson`, and `plainText`.
- API returns note + blocks, but there is no block CRUD yet.

## V1 Data Rules

- Block types: start with `paragraph` and `heading` (others can be allowed but unused).
- `contentJson: { text: string }`, `plainText = text`.
- Positions are contiguous `0..n-1` per note.

## Build Steps

1. Server block operations
   - Create `src/lib/db/blocks.ts` with `createBlock`, `updateBlock`, `deleteBlock`, `reorderBlocks`.
   - Use transactions + AppError/Result patterns.

2. Block API routes
   - `POST /api/blocks` create block.
   - `PUT /api/blocks/:id` update block.
   - `DELETE /api/blocks/:id` delete block.
   - `PUT /api/blocks/reorder` reorder blocks by ordered ids.
   - Use `safeJsonParse`, `safeParseToResult`, and `appErrorToHttp` for consistent errors.

3. Client hooks
   - `useCreateBlock`, `useUpdateBlock`, `useDeleteBlock`, `useReorderBlocks`.
   - Optimistically update `queryKeys.notes.detail(noteId)`.
   - Debounce `useUpdateBlock` for typing.

4. Editor UI
   - Replace the note page placeholder with a client editor.
   - Render blocks, allow typing, split/merge with Enter/Backspace.
   - Add up/down controls for reorder (drag later).

## Optional Safety Rails

- If note has zero blocks, auto-insert one empty paragraph on load.
- Keep update and reorder operations idempotent to support retries.
