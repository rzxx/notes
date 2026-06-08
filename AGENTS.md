# Workflow Notes

- Before finishing implementation work, run `bun lint` and `bun typecheck` to verify code quality and type safety.
- Prefer the in-project Result pattern for fallible operations.
- Use the project's `AppError` and `InternalError` systems for consistent error handling.
