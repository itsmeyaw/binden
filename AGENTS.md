# AGETNS.md

## Development

- Use shadcn and tailwind for UI implementation. Do not write css manually. Use shadcn MCP for more information.
- ponytail mode full
- Use git worktree and github stacked PR for implementation:
  1. Create a git worktree inside .worktrees
  2. Create a new github stack
  3. Implement the changes
  4. Review the changes (ponytail + correctness)
  5. Add the stack
  6. After all changes are implemented, submit the stack

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
