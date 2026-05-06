This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Requirements

- **Node.js** [20.19+](https://nodejs.org/) (20.x LTS) or **22.x** (22.x LTS). Use **22.13+** if you see `EBADENGINE` from ESLint-related packages on older 22.0.x. Node **24+** is excluded by this repo’s `engines` field (tooling targets 20/22 LTS). Use [nvm](https://github.com/nvm-sh/nvm) / [fnm](https://github.com/Schniz/fnm): `nvm use` (reads [`.nvmrc`](.nvmrc)).
- **pnpm** 9+ ([enable Corepack](https://nodejs.org/api/corepack.html): `corepack enable`).

## Getting Started

Install dependencies with [pnpm](https://pnpm.io):

```bash
pnpm install
```

Copy [`.env.example`](.env.example) to `.env.local` and set **Neon** `DATABASE_URL` (runtime) + `DATABASE_URL_DIRECT` (migrations), **Better Auth** secrets, and public URLs (see comments in the example file).

### Neon (this app)

Create (or open) your project in the [Neon console](https://console.neon.tech) → **Connection details**:

- Use the **pooled/serverless** connection string for `DATABASE_URL` (Next.js runtime, Netlify).
- Use the **direct** (non-pooled) connection string for `DATABASE_URL_DIRECT` (Drizzle Kit migrations).

When Neon offers both, see [direct vs pooled](https://neon.tech/docs/connect/connection-pooling).

**Neon MCP (Cursor):** With the [Neon MCP server](https://neon.tech/docs/connect/mcp) enabled, you can run SQL and inspect schema directly against your Neon project (e.g. `list_projects`, `get_database_tables`, `run_sql`, `run_sql_transaction`). That targets the Neon project/branch you connect in MCP—use the same project as in your `.env` connection strings. If `drizzle.__drizzle_migrations` shows migration `0020` but `catalog_customer_price` is missing, the branch is out of sync; re-apply the `0020_catalog_customer_price.sql` migration (or fix the branch) before relying on local `db:migrate` / unseed.

Apply the schema to that database:

```bash
pnpm run db:migrate
# or during early prototyping: pnpm run db:push
```

Optional demo nationalities/services/pricing (not part of migrate):

```bash
pnpm run db:seed:demo
```

To **remove** that demo data and wipe imported customer prices so you can re-import from Excel on a clean catalog:

```bash
pnpm run db:unseed:demo
```

This clears `catalog_customer_price` and `catalog_customer_price_pending`, deletes demo seed rows, removes `visa_service` rows not referenced by any `application`, and drops seed nationalities (US/GB/JP/DE) only if no application uses them. Uses `DATABASE_URL_DIRECT` or `DATABASE_URL` like the seed script.

If unseed errors on missing `catalog_customer_price` after migrate “succeeded”, **`db:migrate` and unseed were likely using different databases** (for example `DATABASE_URL` in your shell vs in `.env`). Both now load **`.env` / `.env.local` from the project root** (same as `drizzle.config.ts`). Re-run `pnpm run db:migrate`, then `pnpm run db:unseed:demo`. The unseed script prints the host/database it connects to so you can confirm it matches Neon.

If the printed migrations look up-to-date but the table is still missing, the database is out of sync with Drizzle’s history; in development you can run `pnpm exec drizzle-kit push` (see Drizzle docs) or fix the branch in Neon.

Then start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Sign up** / **Sign in** to exercise Better Auth against your database.

## Admin vs client authentication

This app intentionally separates **client** and **admin** authentication:

- **Client UI**: `/` (landing), `/sign-in`, `/sign-up`, `/portal/*`
- **Admin UI**: `/admin/sign-in`, `/admin/*`

Under the hood, there are two Better Auth instances with separate database tables and cookies:

- **Client auth**: `/api/auth/*` using tables `user`, `session`, `account`, `verification` (cookie prefix: `client`)
- **Admin auth**: `/api/admin/auth/*` using tables `admin_user`, `admin_session`, `admin_account`, `admin_verification` (cookie prefix: `admin`, and **signup disabled**)

### Creating the first admin account (no frontend signup)

Admin sign-up is disabled in `lib/admin-auth.ts` (`emailAndPassword.disableSignUp: true`). For the very first admin, use one of these operational approaches:

1. **Preferred (temporary server-side signup enable, no UI)**:
   - Temporarily change `disableSignUp: true` → `false` in `lib/admin-auth.ts`
   - Run `pnpm dev`
   - Create exactly one admin via Better Auth’s admin sign-up endpoint:

     ```bash
     curl -X POST "http://localhost:3000/api/admin/auth/sign-up/email" \
       -H "content-type: application/json" \
       -d '{"name":"Admin","email":"admin@example.com","password":"CHANGE_ME_STRONG"}'
     ```

   - Revert `disableSignUp` back to `true` immediately.

2. **Direct DB insertion (advanced)**:
   - Better Auth stores the password hash in `admin_account.password` with `provider_id = 'credential'`.
   - If you choose this path, ensure you use the same hashing format Better Auth expects (by default it uses `scrypt`).

After creating the admin, sign in at `/admin/sign-in`.

Stack: **Next.js App Router**, **Tailwind v4**, **shadcn/ui**, **Drizzle** + **Neon**, **Better Auth**, Cursor **rules** under [`.cursor/rules/`](.cursor/rules/) (tracked in git). Optional local Cursor skills (e.g. Stitch → shadcn) live under `.cursor/skills/` and are **not** committed. Product / UX source of truth: [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md). Design tokens: [`DESIGN.md`](DESIGN.md) and [`app/globals.css`](app/globals.css).

## Deploy on Netlify

This repo includes [`netlify.toml`](netlify.toml) (`pnpm run build`, Node 22). Connect the Git repo in [Netlify’s Next.js guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) and set:

- `DATABASE_URL` — Neon connection string for that environment
- `BETTER_AUTH_SECRET` — strong random secret (`pnpm exec auth secret`)
- `BETTER_AUTH_URL` — primary site URL (no trailing slash)
- `NEXT_PUBLIC_APP_URL` — same origin as the site (usually identical to `BETTER_AUTH_URL`)

Run migrations against the production Neon branch before expecting sign-up/sign-in to work.

## Middleware, API responses, and observability

- **Proxy** (`proxy.ts`, Next.js 16): sets **`x-request-id`** for `/api/*`, `/portal/*`, and `/admin/*`; sets **`x-pathname`** for portal/admin routes so post-login redirects preserve deep links. All API `route.ts` files export `runtime = "nodejs"` to prevent Turbopack edge bundling issues.
- **JSON APIs** (non–Better-Auth): use **`jsonOk` / `jsonError`** from [`lib/api/response.ts`](lib/api/response.ts) and pass through **`x-request-id`** from headers. See [`.cursor/rules/visa-api-response-envelope.mdc`](.cursor/rules/visa-api-response-envelope.mdc).
- **OpenTelemetry** ([`instrumentation.ts`](instrumentation.ts)): optional export via **`OTEL_EXPORTER_OTLP_ENDPOINT`**; server-only. Optional **`OTEL_SERVICE_NAME`**, **`OTEL_DIAGNOSTIC_LOGS=1`**.
- **Logging**: [`lib/logger.ts`](lib/logger.ts) (Pino + redaction). Set **`LOG_LEVEL`** if needed.

Full conventions, RLS follow-ups (audit log, guests, refunds, `system` actor), and **phases 1–4** (catalog/pricing, guests + docs, Paddle, affiliate jobs): [`docs/IMPLEMENTATION_REFERENCE.md`](docs/IMPLEMENTATION_REFERENCE.md).

## Tests

- **`pnpm test`** — Vitest watch mode. **`pnpm test:ci`** — single run (used in [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- Vitest sets a placeholder `DATABASE_URL` when unset so the module graph loads; real DB calls in tests are mocked unless you point at a live database.
- **Postgres RLS integration** ([`tests/integration/rls-catalog.test.ts`](tests/integration/rls-catalog.test.ts)): set **`RUN_DB_TESTS=1`** and a migrated **`DATABASE_URL`** (see [`.env.test.example`](.env.test.example)).

Apply new migrations after pulling (Phase 1 adds **`0003_catalog_addon_rls`**):

```bash
pnpm run db:migrate
```

## RBAC after first admin

Phase 0 seeds permissions and a **`super_admin`** role. Each admin user must have a row in **`admin_user_role`** linking `admin_user.id` to that role (**`00000000-0000-0000-0000-000000000001`**), or `withAdminDbActor` resolves **no permissions**.

- Migration **`0006_seed_super_admin_user_role`** (run via **`pnpm run db:migrate`**) links **`info@visatop.com`** to **`super_admin`** automatically.
- For a different bootstrap email, insert **`admin_user_role`** yourself (same role id) after creating that admin user.

## Git and AI tooling

[`.gitignore`](.gitignore) is set to **commit** [`.cursor/rules/`](.cursor/rules/) (shared project conventions) and to **ignore** `.agents/`, `skills-lock.json`, and the rest of `.cursor/` (e.g. `.cursor/skills/`). None of that affects `pnpm dev` or production builds.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Better Auth](https://www.better-auth.com/docs)
- [Neon](https://neon.tech/docs)
