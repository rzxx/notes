## btca

When you need up-to-date information about technologies used in this project, use btca to query source repositories directly.

**Available resources**: next, react, tailwind, typescript, drizzleOrm, tanstackQuery, zustand, zod, base-ui, dnd-kit

### Usage

\`\`\`bash
btca ask -r <resource> -q "<question>"
\`\`\`

Use multiple \`-r\` flags to query multiple resources at once:

\`\`\`bash
btca ask -r svelte -r effect -q "How do I integrate Effect with Svelte?"
\`\`\`

## Workflow Notes

- Before finishing implementation work, run `bun lint` and `bun typecheck` to verify code quality and type safety.
- Prefer the in-project Result pattern for fallible operations.
- Use the project's `AppError` and `InternalError` systems for consistent error handling.
