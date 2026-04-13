# Notes

`notes` is a development-stage rewrite of **Grainy Notes**: a hierarchical note-taking app built around a simple idea:

> notes should feel like a navigable tree, not a flat pile of documents.

The app combines a file-explorer-style note tree with a lightweight block editor. The current repo is focused on getting the core model, editing flows, and optimistic interactions correct before adding broader product features like authentication, search, collaboration, or rich text.

This README is meant to explain what the project is, why it exists, how it is currently built, and what shape it is moving toward.

## Why this project exists

Many note apps are strong at capture, search, or databases, but weaker at **structured navigation**. This project is opinionated about that tradeoff.

The goal is to build a notes app where:

- notes can live inside other notes
- navigation feels closer to a file tree than a feed
- writing happens in blocks, not one giant textarea
- the UI stays responsive through optimistic updates
- the backend model stays explicit and debuggable

This repo is also a rewrite with cleaner boundaries than the older version documented in [`docs/LEGACY_DOCUMENTATION.md`](docs/LEGACY_DOCUMENTATION.md). Instead of carrying forward a monolithic frontend and loosely structured backend, this version is built around:

- App Router routes and colocated API handlers
- PostgreSQL + Drizzle for explicit relational data
- TanStack Query for server-state management
- Zustand for local tree/editor state
- Zod validation and a Result/AppError error model

## What the app is today

Today, the project is a **single-user development build** of a hierarchical notes app with:

- a left sidebar tree view for browsing notes
- drag-and-drop note reparenting and sibling reordering
- a note page with a block editor
- autosaving block mutations with optimistic updates
- a relational model that supports nested notes without path-string hacks

It is not yet a finished product. The current state is best described as:

- architecture-first
- interaction-heavy
- auth-light
- feature-incomplete by design

## Current capabilities

### Notes tree

- Root and child notes are loaded incrementally.
- Tree state is normalized in a client store.
- Notes can be created, renamed, deleted, moved, and reordered.
- Drag-and-drop supports dropping before, after, or inside another note.
- Pagination and stale-state handling are wired through TanStack Query.
- Optimistic updates include rollback paths for mutation failures.

### Editor

- Notes open at `/note/[id]`.
- Each note contains an ordered list of blocks.
- Current block types are `paragraph` and `heading`.
- Pressing `Enter` splits a block.
- Pressing `Backspace` at the start of a block merges with the previous block.
- Blocks can be reordered with up/down controls.
- Block changes autosave with debounced updates and explicit flushes on blur.
- Empty notes auto-insert a starter paragraph block.

### Backend and data model

- Notes are stored in PostgreSQL.
- Hierarchy is modeled with both `parentId` and a `note_closure` table.
- Sibling ordering uses rank strings rather than dense integer positions.
- Blocks are stored separately from notes and ordered by rank within a note.
- API handlers validate input and return a consistent app error shape.
- Utility endpoints exist to rebuild closure rows and ranks when needed.

## What is intentionally not finished yet

These are known gaps, not surprises:

- Real authentication is not implemented yet. API routes currently use `STUB_USER_ID`.
- Search is planned but not implemented in this codebase yet.
- Rich text spans, nested blocks, sharing, and collaboration are future work.
- There is no test suite yet.
- Some UI copy and metadata still reflect development defaults.
- The root route is still a demo surface for basic note CRUD hooks, while the tree + `/note/[id]` route is the real app shell.

## Architecture overview

### Client

The client is a Next.js App Router app using React 19.

- **TanStack Query** handles data fetching, caching, retry behavior, invalidation, and optimistic mutation coordination.
- **Zustand** stores local tree and editor session state that should not live in the query cache.
- **Base UI** provides menu/dialog/toast primitives.
- **dnd-kit** powers drag-and-drop behavior in the note tree.

The tree is intentionally more than a rendered API response. It keeps a normalized graph of notes plus per-node metadata such as expansion state, loaded children, pagination cursors, and dangling children handling for out-of-order arrival.

### Server

Server code lives under `src/app/api` and `src/lib/db`.

- API routes parse and validate requests with Zod-based schemas.
- Database operations live in focused server modules such as `src/lib/db/notes.ts` and `src/lib/db/blocks.ts`.
- Fallible operations return the project's `Result` type and `AppError` variants instead of throwing arbitrary errors through the stack.

This keeps route handlers thin and pushes domain logic closer to the data model.

### Database

The schema has three core tables:

- `notes`: the main note record, including `parentId`, `title`, and sibling `rank`
- `note_closure`: ancestor/descendant rows used to manage nested-note hierarchy safely
- `blocks`: flat block records per note, each with `type`, `rank`, `contentJson`, and `plainText`

This combination gives the project:

- cheap direct parent access
- safer subtree operations than pure path strings
- stable ordering without rewriting every sibling on each move
- a clear path toward search over block text later

## Stack

- **Framework:** Next.js 16, App Router
- **UI:** React 19, Tailwind CSS 4, Base UI, Lucide icons
- **Data fetching:** TanStack Query
- **Client state:** Zustand + Mutative
- **Drag and drop:** dnd-kit
- **Validation:** Zod
- **Database:** PostgreSQL / Neon
- **ORM:** Drizzle ORM + Drizzle Kit
- **Runtime / package manager:** Bun
- **Language:** TypeScript

## Getting started

### Prerequisites

- [Bun](https://bun.sh)
- a PostgreSQL database connection string

### Environment

Create a local `.env` file with:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
STUB_USER_ID=00000000-0000-0000-0000-000000000001
```

Notes on these variables:

- `DATABASE_URL` is used by Drizzle and the server runtime.
- `STUB_USER_ID` exists because authentication is not wired yet. All API calls currently operate as this user.

### Install and run

```bash
bun install
bun db:push
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful routes while developing:

- `/` - current demo page for basic note CRUD hooks
- `/note/<note-id>` - block editor for a specific note

## Scripts

```bash
bun dev
bun build
bun start
bun lint
bun typecheck
bun db:generate
bun db:migrate
bun db:push
```

Project workflow expectation:

- run `bun lint`
- run `bun typecheck`

before considering implementation work complete.

## Project structure

```text
src/
  app/
    (main)/           Main shell, demo page, note route
    api/              App Router API endpoints
  components/
    editor/           Block editor UI
    tree-view/        Tree navigation UI and DnD behavior
    toasts/           Notification UI
  lib/
    db/               Schema, validators, and DB operations
    hooks/            Query/mutation/editor/tree hooks
    stores/           Zustand stores for tree and editor state
    server/           Error and request parsing helpers
docs/
  PLAN.md             Rewrite plan and current milestones
  TREEVIEW_PROGRESS.md
  LEGACY_DOCUMENTATION.md
drizzle/
  ...                 Generated migrations and snapshots
```

## API surface

Current API endpoints include:

- `GET /api/notes` - list children for a parent
- `POST /api/notes` - create a note
- `DELETE /api/notes` - delete a note
- `GET /api/notes/[id]` - fetch note metadata and blocks
- `PUT /api/notes/[id]` - rename a note
- `PUT /api/notes/move` - move or reorder a note
- `POST /api/blocks` - create a block
- `PUT /api/blocks/[id]` - update a block
- `DELETE /api/blocks/[id]` - delete a block
- `PUT /api/blocks/split` - split one block into two
- `PUT /api/blocks/merge` - merge adjacent blocks
- `PUT /api/blocks/reorder` - reorder blocks inside a note
- `POST /api/notes/rebuild-closure-table` - rebuild note closure rows
- `POST /api/notes/rebuild-ranks` - rebuild note ranks

## Design choices worth knowing

### Why a closure table instead of only `parentId`?

`parentId` is convenient for direct parent/child access, but it is not enough on its own when subtree operations become more complex. The closure table makes move and ancestry operations explicit and gives the project a safer long-term foundation for nested note logic.

### Why rank strings instead of integer positions?

Dense integer positions make reorder operations progressively more expensive because moving one item often forces updates to many siblings. Rank-based ordering avoids most of that churn and matches the kind of optimistic interaction this app wants.

### Why a custom block editor for now?

The current editor is intentionally narrow. It proves the data model and interaction contract first: split, merge, reorder, autosave, focus management, and optimistic mutations. Rich text can be layered on later once those basics are stable.

## Roadmap direction

Near-term work visible in the repo docs:

- replace `STUB_USER_ID` with real auth
- add search over note content
- improve editor capabilities beyond plain text paragraph/heading blocks
- eventually support nested blocks
- add tests and CI

If you want the longer background and planning history, start with:

- [`docs/PLAN.md`](docs/PLAN.md)
- [`docs/TREEVIEW_PROGRESS.md`](docs/TREEVIEW_PROGRESS.md)
- [`docs/LEGACY_DOCUMENTATION.md`](docs/LEGACY_DOCUMENTATION.md)

## Status summary

This repo is already useful as a serious foundation for a hierarchical notes app, but it should still be read as **an active rewrite**, not a completed product. The important thing about it today is not that every feature exists. It is that the project already has a coherent shape:

- a clear product thesis
- a data model that matches that thesis
- editor and tree interactions that are being built for correctness first
- enough structure to keep growing without collapsing into a demo mess
