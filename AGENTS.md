<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## This project

Sumbong · BetterCabanatuan: residents report public-space problems; volunteers review them and carry them to the responsible office. Read `README.md` for the flow and `CONTEXT.md` for the domain language. Use its terms (Report, Reporter, Follower, Volunteer, Coordinator, Responsible Office, Digest, Review, Misroute, Me Too) in code, UI copy and docs.

- `npm test` runs the migrations against PGlite + PostGIS (`tests/db/`). Add a test there for any change to `supabase/migrations`.
- Business rules belong in SQL (`supabase/migrations/*_logic.sql`): the status trigger plus SECURITY DEFINER functions that check roles. Don't update `reports` directly from app code.
- Never edit an applied migration once it has been pushed to a real project; add a new one.
- Resident-facing copy goes in `src/messages/{fil,en}.json`, keeping both files' keys identical (a test checks this). Volunteer screens under `/v` are English-only.
- UI is shadcn/ui on Base UI (`src/components/ui`, add more with `npx shadcn@latest add`). Links styled as buttons use `<Button nativeButton={false} render={<Link … />}>`. Use theme tokens (`bg-primary`, `text-muted-foreground`, `bg-sun`, `text-navy`, `bg-status-forwarded`…) defined in `src/app/globals.css`, never raw colors.
- The board list uses TanStack Query: `src/lib/board.ts` holds the shared query options (server prefetch + browser `useInfiniteQuery`); "Ako rin" is an optimistic `useMutation` in `src/components/board/use-me-too.ts`.
