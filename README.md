This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Workspace profile reads use each user’s read-only OAuth grant and the public Directory view; Directory sharing is administrator-managed and assumed enabled.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Workspace reviewer access

Set `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_WORKSPACE_DOMAIN`, and `GOOGLE_REVIEWER_ROLE_ID`. Configure an internal Google OAuth web
client with `<BETTER_AUTH_URL>/api/auth/callback/google`, enable Admin SDK, and grant the reviewer
role to the administrators who may access `/review`. The app requests only the Directory profile
and role-management read scopes and stores OAuth credentials server-side.

Run `pnpm exec drizzle-kit migrate` after setting `DATABASE_URL`.

`pnpm test:e2e` is opt-in: it requires a running application at `E2E_BASE_URL`, its disposable
database as `TEST_DATABASE_URL`, and an uncommitted authenticated storage-state file at
`E2E_GOOGLE_STORAGE_STATE`. See `docs/live-workspace-smoke-check.md` for live-tenant verification.

## Code Quality

```bash
pnpm lint          # Check with Oxlint
pnpm lint:fix      # Apply lint fixes
pnpm format        # Format with Oxfmt
pnpm format:check  # Check formatting without changing files
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
