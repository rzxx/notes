# Notes

> A tree-based note-taking app. Notes live inside other notes, like a file explorer. You can drag them around, type in blocks, and pretend it's Notion.

**Live:** [notes-nine-lac.vercel.app](https://notes-nine-lac.vercel.app/)

[Русская версия](docs/README.ru.md)

## What is this

It's a hierarchical note-taking thing. Left side: a tree you can drag around. Right side: a block editor where you type paragraphs and headings. Notes nest inside notes. Blocks split, merge, and autosave.

That's pretty much it.

You're free to use it, but you'd kind of be a masochist. Query times are rough from outside the US, the UI has rough edges, and half the features you'd expect from a real notes app don't exist yet.

It exists because I wanted to learn how to build:

- A tree that doesn't fall over when you drag things
- Optimistic updates that roll back gracefully when the server says "nah"
- A block editor with real CRUD operations
- A relational data model that handles nested hierarchies without string-path hacks

## What's cool here

- Closure table for note hierarchy
- Drag & drop with optimistic updates and rollback
- Block editor with split, merge, reorder, autosave
- LexoRank ordering for stable sibling ordering
- Result-based error handling
- Shoo auth

## Stack

Next.js 16, React 19, Tailwind CSS 4, TanStack Query, Zustand, dnd-kit, Drizzle ORM, PostgreSQL (Neon), Zod, Bun.

## Run locally

```bash
bun install
bun db:push
bun dev
```

Need a `.env` with `DATABASE_URL` and `APP_ORIGIN`.

## Status

Architecture-first, interaction-heavy, feature-incomplete by design. Search is missing. Rich text is missing. Tests are missing. But the core model and editor flow are solid.

Full roadmap in [`docs/PLAN.md`](docs/PLAN.md) if you care.
