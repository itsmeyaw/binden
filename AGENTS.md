# AGETNS.md

## Development

- Use shadcn and tailwind for UI implementation. Do not write css manually. Use shadcn MCP for more information.
- Always check if shadcn has component for implementation, if not yet added, then add the component from shadcn using its mcp and cli.
- ponytail mode full
- Use git worktree and github stacked PR for implementation:
  1. Create a git worktree inside .worktrees
  2. Create a new github stack on the worktree
  3. Implement the changes, lint and format.
  4. Commit the changes.
  5. Review the changes (ponytail + correctness), repair and add additional commit as necessary.
  6. Add the stack to github.
  7. After all changes are implemented, submit the stack to github.
  8. Update the issue in the issue tracker by adding summary of. implementation and related PR.
- Database use drizzle ORM.
- Commit in small incremental changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues and specs are tracked in this repo's GitHub Issues; use `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context layout. See `docs/agents/domain.md`.
