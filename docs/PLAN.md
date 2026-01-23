# Implementation plan (flat blocks now, tree later)

### Phase 1 — Foundations & Spine (skip auth)

#### 1) Project + runtime boundaries

- App Router + TS strict + lint + CI
- Server-only modules:
  - `lib/db/drizzle.ts` (Drizzle + Postgres connection) [done]
  - `lib/db/notes.ts` (query functions used by route handlers) [done]

- Client-only providers:
  - `app/providers.tsx` (TanStack Query + Zustand) [done]

**Why:** sets clean “server vs client” walls so you don’t leak DB into client bundles.

---

#### 2) DB schema v1 (notes closure table + flat blocks)

**Tables**

- `notes` [done]
  - `id`, `userId` (stub for now), `parentId` nullable, `title`, timestamps
  - constraint: `UNIQUE(user_id, parent_id, title)` (or `slug`)
  - ordering: by `createdAt` (cursor pagination on `createdAt` + `id`)

- `note_closure` [done]
  - `userId`, `ancestorId`, `descendantId`, `depth`
  - PK: `(user_id, ancestor_id, descendant_id)`
  - indexes: `(user_id, ancestor_id)`, `(user_id, descendant_id)`

- `blocks` (flat) [done]
  - `id`, `noteId`, `userId`, `type`, `position`, `contentJson` (jsonb), `plainText` (text), timestamps
  - index: `(note_id, position)`

**Why flat blocks now:** you can build CRUD/reorder/autosave without subtree rules.

**Also add day-1 safety rails**

- all note create/move/delete ops in transactions (because closure updates) [done]
- a “rebuild closure from parentId” script (your seatbelt) [done]

---

#### 3) Closure table operations (minimum set)

Implement server functions (not API yet) for:

- `createNote(parentId, title)` [done]
  - insert note
  - insert closure rows:
    - self row (note, note, depth 0)
    - for each ancestor of parent: (ancestor -> note, depth+1)

- `moveNote(noteId, newParentId)` [done]
  - cycle check using closure
  - update `notes.parentId`
  - update closure rows for subtree (transaction)

- `deleteNote(noteId)` (current behavior: lift children) [done]
  - reparent direct children to the deleted note’s parent
  - adjust closure depths for lifted descendants
  - delete from notes (cascade) + closure rows (cascade)

**Why:** do it before API so you can unit test it easily.

---

#### 4) API routes (contract first)

Build these route handlers:

- `GET /api/notes?parentId=...&cursor=...` [done]
  List children of a folder (metadata only)

- `POST /api/notes`
  Create under `parentId` with unique naming (title collision -> “(2)” or “-2”) [done]

- `GET /api/notes/:id` [done]
  Note metadata + blocks (ordered)

- `PUT /api/notes/:id` [done]
  Rename note (Phase 1 scope)

- `DELETE /api/notes` [done]

- `PUT /api/notes/move` [done]
  Move note by changing parentId (calls closure logic)

Standardize error shape now.

**Why:** once this contract exists, TanStack Query becomes straightforward.

---

#### 5) Query + UI scaffolding

- Add QueryClientProvider in `app/providers.tsx`
- Write base hooks:
  - `useNotesChildren(parentId)`
  - `useNote(noteId)`
  - `useCreateNote()`
  - `useMoveNote()`
  - `useRenameNote()`

- UI:
  - left nav lists children of selected folder
  - center shows blocks of selected note (read-only at first)
  - right panel placeholder

**Why:** you’ll see data flowing end-to-end before editor complexity.

---

### Phase 2 — Core parity (flat block editor)

#### 6) Flat block editor MVP (no rich text yet)

Block types: paragraph/heading/divider (maybe quote)

- Paragraph + heading use `contentJson: { text: string }` for now
- Keep `plainText = text`

Editor behaviors (minimal):

- Enter splits current block into two blocks
- Backspace at start merges with previous
- Reorder blocks (up/down buttons first; drag later)
- Autosave on debounce or blur
- Optimistic update via TanStack Query for block edits

**Why:** this proves your block CRUD + optimistic mutations + ordering scheme.

---

#### 7) Search v1 (FTS on blocks.plainText)

- Add DB index for FTS on `plainText`
- `GET /api/notes/search?q=...` returns note hits (metadata-only)

**Why:** validates your “blocks as search surface” approach.

---

### Phase 3 — Rich text (your Option B)

#### 8) Upgrade paragraph/heading/quote to richText spans

Change `contentJson` to:

- `{ richText: Span[] }`
  And implement normalization invariants:
- merge adjacent spans with same marks
- remove empties

At first, you can still edit as plain text (one span) just to get storage ready.

---

#### 9) Pick editing strategy for formatting

Choose one (later):

- integrate an engine (Lexical/Tiptap) and serialize ↔ spans
  or
- custom contentEditable + selection transforms (hard mode)

**Why:** you don’t block the rewrite on the hardest part.

---

### Phase 4 — Nested blocks (tree)

#### 10) Add `parentBlockId` and sibling ordering

- blocks gain `parentBlockId` nullable
- position now “among siblings”
- editor adds indent/outdent, toggles, lists, collapse

This is where you’ll also likely want a “block closure table” _if_ you do heavy subtree queries, but for blocks it’s often not needed because notes aren’t huge.

---

## The immediate “next 5 tasks” you should do now

To keep momentum, do these in order:

1. Implement `moveNote()` server function (cycle check + closure updates) [done]
2. Add `PUT /api/notes/:id/move` (or `/api/notes/move`) endpoint + wire schema [done]
3. Add `GET /api/notes/:id` (metadata + blocks) and basic `PUT /api/notes/:id` (rename) [done]
4. Add client hooks: `useNotesChildren`, `useCreateNote`, `useMoveNote`, `useRenameNote`
5. Replace the starter UI with a left-nav list that can create notes + move notes

Once that works, everything else becomes easier.
