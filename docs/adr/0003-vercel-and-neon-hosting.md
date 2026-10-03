# Host on Vercel with Neon Free Postgres

Deploy the existing Next.js application on Vercel and store applicant and approval-workflow data in Neon Postgres using its free tier and Drizzle ORM. This keeps the small nonprofit's operating costs low while retaining Google Workspace as the authoritative source for managed accounts, profiles, groups, and administrator privileges.

Design for inexpensive operation with serverless execution and an idle database that can scale to zero. Hosting plans, tier changes, and provider allowances are managed manually outside the application; do not implement tier management or automatic upgrades.

Use Neon's native recovery initially, accepting the Free plan's currently documented six-hour restore window for application-owned records. Independent backups can be reconsidered if loss of pending workflow records becomes unacceptable. Managed Workspace data remains authoritative in Google.
