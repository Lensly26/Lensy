<<<<<<< HEAD
# Lensly

Desktop-first communication app (Discord-class) with a clean UI, SQLite for **local dev** (no Docker), optional PostgreSQL for production, real-time channels, admin tools, and room to grow.

## Prerequisites

- Node **20+** and npm
- **Rust** (only if you run `tauri dev` / `tauri build`) — [rustup](https://rustup.rs/)
- Docker is **optional** (only if you switch to PostgreSQL; see `.env.example`)

## Quick start (Windows-friendly)

```powershell
cd Lensly
copy .env.example .env
npm install
npm run setup
npm run dev
```

Then open **http://localhost:5173** — API: **http://localhost:3001**.

### What `npm run setup` does

Generates the Prisma client, builds `@lensly/database`, runs `prisma db push`, and seeds the admin user (`tylerplayz`). Default DB is a **SQLite file** at `packages/database/prisma/dev.db` (from `DATABASE_URL="file:./dev.db"` in `.env`).

### If `npm install` fails with Prisma `EPERM` / rename `query_engine-windows.dll`

On Windows another Node process (often a running `npm run dev`) is **locking** Prisma’s engine file.

1. Close every terminal running the Lensly API/desktop.
2. In Task Manager, end stray **Node.js** processes if needed.
3. Run `npm install` again.

Do **not** use `prepare` hooks that run `prisma generate` during install (this repo avoids that).

### Internal Server Error on signup / login

Usually the database file was never created or `DATABASE_URL` still points at Postgres while the schema uses SQLite.

- Ensure `.env` has: `DATABASE_URL="file:./prisma/dev.db"` (see `.env.example`).
- Run `npm run setup` again.

`GET /health` = API process up. `GET /health/ready` = database reachable (503 if not).

## Monorepo layout

- `apps/desktop` — React + Vite UI, optional **Tauri** (`src-tauri/`)
- `packages/api` — Fastify HTTP + WebSocket API
- `packages/database` — Prisma schema + seed

## Environment variables

See `.env.example`. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to long random strings for anything beyond local play.

## Bootstrap admin (`fearless`)

`npm run setup` / `npm run db:seed` creates the admin from `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## PostgreSQL (optional)

For a Postgres URL, change `provider` in `packages/database/prisma/schema.prisma` to `postgresql`, set `DATABASE_URL` accordingly, then `npm run db:push` and `npm run db:seed`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | API + Vite together |
| `npm run setup` | Generate client, build DB package, push schema, seed |
| `npm run db:push` | Apply schema to the DB |
| `npm run db:seed` | Seed admin + badge |
| `npm run build:db` | Compile `@lensly/database` |

## Native desktop (optional)

```powershell
cd apps/desktop
npm run tauri:dev
```

Requires Rust and `npm run setup` from the repo root first.
=======
# Lensy
>>>>>>> 8378a1008c8a528f80cfb1136bb8a7373aa470ba
