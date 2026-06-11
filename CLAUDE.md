# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses Bun as the package manager/runtime.

```bash
bun install              # install dependencies
bun --bun run dev        # dev server on port 3000
bun --bun run build      # production build
bun --bun run test       # run all tests (vitest run)
bunx vitest run src/path/to/file.test.tsx   # run a single test file
bun --bun run lint       # eslint
bun --bun run format     # prettier --write + eslint --fix
bun --bun run check      # prettier --check
bun run deploy           # build + wrangler deploy (Cloudflare Workers)
```

Database (Drizzle Kit, reads `DATABASE_URL` from `.env.local`/`.env`):

```bash
bun run db:generate      # generate migrations from schema
bun run db:migrate       # apply migrations
bun run db:push          # push schema directly to db
bun run db:studio        # drizzle studio
```

Add shadcn/ui components with the latest version of shadcn:

```bash
pnpm dlx shadcn@latest add button
```

## Architecture

TanStack Start (React 19, SSR) app deployed to Cloudflare Workers via the Cloudflare Vite plugin (`vite.config.ts`) and `wrangler.jsonc`. Styling is Tailwind CSS v4 (configured through the Vite plugin, no tailwind.config file). AI chat functionality uses the `@tanstack/ai` packages with provider adapters (Anthropic, OpenAI, Gemini, Ollama).

- **Routing**: File-based via TanStack Router. Routes live in `src/routes/`; `src/routeTree.gen.ts` is auto-generated (by the dev server or `bun run generate-routes`) — never edit it by hand. The root layout/document shell is `src/routes/__root.tsx`. API routes are route files with a `server.handlers` property (e.g. `src/routes/api/auth/$.ts`).
- **Server code**: Use `createServerFn` from `@tanstack/react-start` for server functions, or route loaders for data fetching.
- **Auth**: Better Auth, configured in `src/lib/auth.ts` (email/password + TanStack Start cookies plugin), exposed through the catch-all route `src/routes/api/auth/$.ts`. Client helpers in `src/lib/auth-client.ts`. Requires `BETTER_AUTH_SECRET` in `.env.local`.
- **Database**: Drizzle ORM over better-sqlite3. Schema in `src/db/schema.ts`, client in `src/db/index.ts`, Drizzle Kit config in `drizzle.config.ts` (migrations output to `./drizzle`).
- **Path aliases**: `#/*` and `@/*` both map to `./src/*` (see `tsconfig.json`). `allowImportingTsExtensions` is on — imports may include `.ts` extensions (e.g. `src/db/index.ts` imports `./schema.ts`).
- **Env vars**: `ANTHROPIC_API_KEY`, `BETTER_AUTH_SECRET`, `DATABASE_URL` go in `.env.local`. For production, secrets go via `wrangler secret put`; public vars in `wrangler.jsonc` under `vars`.

Files prefixed with `demo` are scaffold examples and can be safely deleted.
