<<<<<<< HEAD

# WA-Scheduler

Multi-tenant WhatsApp group message scheduler. Connect a WhatsApp account, sync your groups, and schedule recurring messages with cron expressions/timezone support or fixed interval mode, including up to 5 image attachments per scheduled message.

> ⚠️ **Terms of Service warning.** This project uses an unofficial WhatsApp Web library ([baileys](https://github.com/WhiskeySockets/Baileys)). Connecting a personal WhatsApp account this way **violates WhatsApp's Terms of Service** and may result in your account being permanently banned. Use only with throwaway numbers and accept all risk. There is no official WhatsApp API for sending messages to groups outside the WhatsApp Business Platform.

## Architecture

```
┌──────────┐     ┌────────────────┐     ┌──────────┐
│ Frontend │────▶│   Backend API  │────▶│ Postgres │
│  (Vite)  │ HTTP│   (NestJS)     │     └──────────┘
│          │ WS  │                │     ┌──────────┐
└──────────┘────▶│  Socket.IO     │     │  Redis   │
                 │  BullMQ worker │────▶│ (BullMQ) │
                 │  Baileys WA    │     └──────────┘
                 └────────┬───────┘
                          │ persistent WebSocket
                          ▼
                    WhatsApp Web servers
```

- **backend** — NestJS 10 + Prisma + BullMQ + Baileys + Socket.IO. Single-instance only (Baileys sockets are held in process memory).
- **frontend** — React 18 + Vite + Tailwind + React Query.
- **postgres** — schedules, groups, encrypted Baileys credentials, message logs.
- **redis** — BullMQ queues + per-tenant send locks.

## Locked design decisions

| Concern              | Decision                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue engine         | BullMQ via `@nestjs/bullmq`, repeatable jobs with cron `{ pattern, tz }` or interval `{ every, startDate }`, `jobId == scheduleId`.                        |
| Tenancy              | One user per tenant. Atomic register transaction. Prisma `$extends` injects `tenantId` into every query.                                                   |
| Auth                 | JWT bearer, `Authorization: Bearer …`, expiry 12h.                                                                                                         |
| WhatsApp library     | `baileys` ^6.7.16 (the active maintained fork, **not** `@whiskeysockets/baileys`).                                                                         |
| Auth state storage   | Per-tenant: encrypted `WhatsAppSession.encryptedCreds` (single row) + `WhatsAppAuthKey` (one row per Signal pre-key). All values AES-256-GCM.              |
| Encryption           | AES-256-GCM, 12-byte IV, 16-byte auth tag, format `[IV ‖ tag ‖ ciphertext]`. Master key in `ENCRYPTION_KEY` (64 hex chars).                                |
| Message log statuses | `pending` → `sent` \| `failed` only. No `queued`/`retrying`.                                                                                               |
| Daily cap            | `DAILY_MESSAGE_CAP_PER_TENANT=100` per tenant per day in tenant timezone. Counts `sent + pending`. Over-cap → `failed:daily_cap_exceeded`, no retry.       |
| Anti-ban             | 5–10 s jittered delay between sends per tenant, Redis `SETNX wa:lock:tenant:{id}` with 30 s TTL serializes, 3 retries with exponential backoff (5 s base). |
| Log retention        | `LOG_RETENTION_DAYS=7`, daily 03:00 cron prune.                                                                                                            |
| Single instance      | `docker-compose.yml` has `deploy.replicas: 1`. Scaling out would require migrating Baileys session ownership across instances — out of scope.              |

## Getting started

### Prerequisites

- Node 20+
- PostgreSQL 16
- Redis 7
- Docker + Docker Compose (optional)

### 1. Generate secrets

```bash
# Master encryption key for Baileys credentials at rest (64 hex chars):
openssl rand -hex 32

# JWT signing secret (long enough — base64 48 bytes):
openssl rand -base64 48
```

### 2. Configure environment

Copy `.env.example` → `.env` and fill in the secrets above:

```env
# Postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wa_scheduler

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<paste base64 from step 1>
JWT_EXPIRES_IN=12h

# Encryption (must be exactly 64 hex chars = 32 bytes)
ENCRYPTION_KEY=<paste hex from step 1>

# App
PORT=3000
CLIENT_URL=http://localhost:5173

# Sending policy
DAILY_MESSAGE_CAP_PER_TENANT=100
MESSAGE_DELAY_MIN_MS=5000
MESSAGE_DELAY_MAX_MS=10000
LOG_RETENTION_DAYS=7

# Cloudinary (for schedule image attachments)
CLOUDINARY_CLOUD_NAME=<your cloud name>
CLOUDINARY_API_KEY=<your api key>
CLOUDINARY_API_SECRET=<your api secret>
CLOUDINARY_FOLDER=wa-scheduler
```

### 3. Run locally (without Docker)

Create app-local env files so each app can run from its own folder:

```bash
# from repo root
cp .env backend/.env
cp .env frontend/.env
```

If you're on Windows PowerShell, use:

```powershell
Copy-Item .env backend/.env
Copy-Item .env frontend/.env
```

Then run:

```bash
# backend terminal
cd backend
npm install
npx prisma migrate dev
npm run start:dev   # http://localhost:3000

# frontend terminal
cd frontend
npm install
npm run dev         # http://localhost:5173
```

### 4. Run with Docker (optional)

```bash
docker compose up --build
```

Then:

```bash
# Apply database migrations:
docker compose exec backend npx prisma migrate deploy
```

The frontend is served at <http://localhost:5173> and the backend at <http://localhost:3000>.

## End-to-end test plan (manual)

1. **Register** a new workspace at `/register` — choose a timezone.
2. **Connect WhatsApp** at `/connect`. Click _Start QR session_, scan the QR with Phone → WhatsApp → Linked devices. Status flips to `connected`.
3. **Sync groups** at `/groups`. The list populates from the linked WhatsApp account.
4. **Create a schedule** at `/schedules/new`:
   - Pick 1–2 groups (or search/filter the group list first).
   - Optionally attach up to 5 images.
   - Use either:
     - a near-future cron for testing (must be >= 30 minutes between runs), or
     - interval mode (30+ minutes), e.g. every 30 or 60 minutes.
   - Pick your timezone.
5. Watch `/logs` — a `pending` row appears on each trigger and then flips to `sent` (with a `whatsappMessageId`) or `failed` (with `errorReason`).
6. **Pause** the schedule on the list page; verify no further runs.
7. **Resume**; verify firing resumes.
8. **Edit** the schedule (cron / message / groups). Confirm new fan-outs use the updated payload — schedules in flight at the moment of the edit complete with the _previous_ message; subsequent triggers use the new one.
9. **Daily cap**: temporarily set `DAILY_MESSAGE_CAP_PER_TENANT=2` and create a schedule that fires to 5 groups; verify 2 succeed, 3 fail with `daily_cap_exceeded` and are not retried.
10. **Disconnect** WhatsApp at `/connect`; verify `WhatsAppSession` and `WhatsAppAuthKey` rows are wiped for that tenant.

## Behavior notes

- **Edit while in flight**: Each trigger pre-creates `MessageLog` rows in a transaction snapshotting the message text + groups at fire time. Editing the schedule afterwards does _not_ alter messages already enqueued for the current run; only future fan-outs see the new content.
- **Interval schedules**: For expressions like `*/N * * * *` and `0 */N * * *`, the scheduler stores an interval anchor and runs using fixed `every` cadence in BullMQ from that anchor. Reactivating or changing the cron resets the anchor to the current time.
- **Multiple instances**: Scaling backend replicas > 1 is unsupported. Baileys WebSocket sessions are kept in process memory; a duplicate process would race on Postgres credentials and likely log out the device. The compose file pins `replicas: 1`.
- **Disconnect / re-link**: On `loggedOut` from WhatsApp the backend automatically wipes that tenant's session + key rows so the next `/whatsapp/connect` starts fresh with a new QR.
- **Restart safety**: On boot the backend reconnects every tenant whose `WhatsAppSession.encryptedCreds` is non-null and re-registers BullMQ repeatable jobs for every `active` schedule (`SchedulesService.rehydrateRepeats`).

## Tests

```bash
cd backend
npm test
```

Covers `AuthService`, `TenantPrismaService` extension contract, and cron / timezone helpers used by `SchedulesService`.

## Troubleshooting

| Symptom                                              | Verify quickly                                                                                                         | Fix                                                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Status stays `connecting`, no QR appears             | Check backend logs for reconnect loops / connection close events.                                                      | Ensure outbound internet access from backend to WhatsApp Web endpoints, then retry from `/connect`.                                     |
| QR scans, status flips to `disconnected: logged_out` | Confirm `logged_out` is emitted in `/connect` status or backend logs.                                                  | Re-link with a different WhatsApp number/device state (remove stale linked devices first). Logged-out sessions are wiped automatically. |
| Logs stay `pending` forever                          | Confirm backend process is running and Redis is reachable (`REDIS_URL`). Look for `MessageSendProcessor` startup logs. | Start/fix Redis connectivity and restart backend worker process. Pending rows will resolve on the next trigger run.                     |
| Schedule fires at wrong time                         | Compare schedule timezone and tenant timezone to your expected local time.                                             | Set the correct IANA timezone on the schedule and save again. Cron evaluation uses schedule timezone, not server timezone.              |
| Save fails with cron interval error                  | Check the cron expression frequency.                                                                                   | Use interval >= 30 minutes (for example `*/30 * * * *`, `0 */1 * * *`, `0 */2 * * *`) or less frequent cron patterns.                   |
| Sends fail with `daily_cap_exceeded`                 | Check `DAILY_MESSAGE_CAP_PER_TENANT` and today's `pending + sent` volume for the tenant.                               | Increase cap for testing or reduce fan-out/frequency. These failures are intentionally not retried.                                     |
| `Invalid encryption key` at boot                     | Validate `ENCRYPTION_KEY` length and format.                                                                           | Regenerate with `openssl rand -hex 32`, place exactly 64 hex chars in `.env`, then restart backend.                                     |

## License

# Personal/educational use only. **You are solely responsible** for any account bans or other consequences of running this against your WhatsApp account.

# wa-group-scheduler

> > > > > > > 4f068232b64f6cd4e866a6091ad00fae13992945
