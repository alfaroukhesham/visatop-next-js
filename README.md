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

Apply the schema to that database:

```bash
pnpm run db:migrate
# or during early prototyping: pnpm run db:push
```

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

- **Middleware** (`middleware.ts`): sets **`x-request-id`** for `/api/*`, `/portal/*`, and `/admin/*`; sets **`x-pathname`** for portal/admin routes so post-login redirects preserve deep links.
- **JSON APIs** (non–Better-Auth): use **`jsonOk` / `jsonError`** from [`lib/api/response.ts`](lib/api/response.ts) and pass through **`x-request-id`** from headers. See [`.cursor/rules/visa-api-response-envelope.mdc`](.cursor/rules/visa-api-response-envelope.mdc).
- **OpenTelemetry** ([`instrumentation.ts`](instrumentation.ts)): optional export via **`OTEL_EXPORTER_OTLP_ENDPOINT`**; server-only. Optional **`OTEL_SERVICE_NAME`**, **`OTEL_DIAGNOSTIC_LOGS=1`**.
- **Logging**: [`lib/logger.ts`](lib/logger.ts) (Pino + redaction). Set **`LOG_LEVEL`** if needed.

Full conventions, RLS follow-ups (audit log, guests, refunds, `system` actor), and **phases 1–4** (catalog/pricing, guests + docs, Paddle, affiliate jobs): [`docs/IMPLEMENTATION_REFERENCE.md`](docs/IMPLEMENTATION_REFERENCE.md).

## RBAC after first admin

Phase 0 seeds permissions and a **`super_admin`** role in the database. After you create the first admin user (see above), **assign that role** by inserting into **`admin_user_role`** (link `admin_user.id` to role id **`00000000-0000-0000-0000-000000000001`**). Without this, `withAdminDbActor` resolves **no permissions** and RLS will deny access to protected tables.

## Git and AI tooling

[`.gitignore`](.gitignore) is set to **commit** [`.cursor/rules/`](.cursor/rules/) (shared project conventions) and to **ignore** `.agents/`, `skills-lock.json`, and the rest of `.cursor/` (e.g. `.cursor/skills/`). None of that affects `pnpm dev` or production builds.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Better Auth](https://www.better-auth.com/docs)
- [Neon](https://neon.tech/docs)
