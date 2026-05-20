# Hall 3 Return Points Portal

Web portal for Hall 3 tutors to manage resident return points across Events, ICFD (sports), Floor Reps, and HSO performance.

## Stack

- Next.js 15 + TypeScript
- PostgreSQL + Prisma
- NextAuth (credentials)
- ExcelJS for import/export
- BullMQ + Redis for background parsing
- S3-compatible storage (MinIO locally, R2 in prod)

## Quick start

```bash
# Copy env and enable local file storage (no MinIO required for dev)
cp .env.example .env
echo 'USE_LOCAL_STORAGE=true' >> .env

# Start Docker Desktop first (macOS: open -a Docker), wait until the whale icon is steady

# Start Postgres + Redis
docker compose up -d postgres redis

# Install & migrate
pnpm install
pnpm db:push
pnpm db:seed

# Optional: import sample Hall 3 Excel files (21 events, 6 sports, floor reps, HSO)
pnpm bootstrap

# Generate a small test upload file (uses roster SIDs from bootstrap)
pnpm fixture

# Dev server (keep this terminal open)
pnpm dev
```

Sign in with:
- `master@hall3.dev` / `hall3dev` (MASTER)
- `tutor@hall3.dev` / `hall3dev` (TUTOR)
- `admin@hall3.dev` / `hall3dev` (SUPER_ADMIN)

## Upload test walkthrough

After `pnpm bootstrap` and `pnpm fixture`:

1. Sign in as `tutor@hall3.dev` / `hall3dev`
2. Open **http://localhost:3000/h/hall-3**
3. Click **Categories** → **2025-26 Sem A** → **Events**
4. Click **New activity** — name it e.g. `Upload Test Event`, save
5. On the **Overview** tab, click **Upload file** and choose `data/samples/test-event-upload.xlsx`
6. You are redirected to the **parse review** page — status should be `PARSED` with a matched row count
7. Click **Apply to activity**
8. Open the **Participants** tab — OC, Helper, and Participant rows should appear with points
9. Open **Points** in the nav — totals should include this event after apply

Re-uploading the same file to an event that already has participants **updates** existing rows (no duplicates).

You can also upload a real sheet from `0. Events_Summary25.xlsx` (e.g. copy `1.WelcomeParty2025` to its own file) into any empty event folder.

## Excel parsing in dev

By default uploads are parsed **synchronously** (`ENABLE_QUEUE=false` in `.env`). No worker process needed.

For production / large files, set `ENABLE_QUEUE=true` and run `pnpm worker` alongside the app.

## Worker

For background Excel parsing (when `ENABLE_QUEUE=true`):

```bash
pnpm worker
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm db:seed` | Seed Hall 3 + users |
| `pnpm bootstrap` | Import sample xlsx files into DB |
| `pnpm fixture` | Generate `data/samples/test-event-upload.xlsx` |
| `pnpm test` | Unit tests (parsers) |
| `pnpm test:e2e` | Playwright E2E |

## Troubleshooting Docker

If you see:

```text
failed to connect to the docker API at unix:///Users/.../docker.sock
```

**Docker Desktop is not running.** Fix:

1. Open **Docker Desktop** from Applications (or run `open -a Docker` in Terminal).
2. Wait 30–60 seconds until the menu bar whale icon stops animating.
3. Run `docker compose up -d postgres redis` again.

Redis is optional for dev — Excel uploads parse synchronously if the queue is unavailable. Postgres is required; use Docker as above or point `DATABASE_URL` at any Postgres host (Neon, Supabase, etc.).

## Sample data

Excel samples live in `data/samples/`:
- `0. Events_Summary25.xlsx`
- `0.ICFD_Summary25.xlsx`
- `Floor Reps25_26.xlsx`
- `HSO-202526-Performance.xlsx`
- `test-event-upload.xlsx` — small fixture for upload testing (`pnpm fixture`)
