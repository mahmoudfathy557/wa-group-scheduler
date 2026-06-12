# WA-Scheduler

Multi-tenant WhatsApp group message scheduler. Connect a WhatsApp account, sync your groups, and schedule recurring messages with cron expressions and timezone support.

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
| Queue engine         | BullMQ via `@nestjs/bullmq`, repeatable jobs `{ pattern, tz }`, `jobId == scheduleId`.                                                                     |
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

- Docker + Docker Compose
- Or, for local dev: Node 20+, PostgreSQL 16, Redis 7

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
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/wa_scheduler

# Redis
REDIS_URL=redis://redis:6379

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
SEND_MIN_DELAY_MS=5000
SEND_MAX_DELAY_MS=10000
LOG_RETENTION_DAYS=7
```

### 3. Run with Docker

```bash
docker compose up --build
```

Then:

```bash
# Apply database migrations:
docker compose exec backend npx prisma migrate deploy
```

The frontend is served at <http://localhost:5173> and the backend at <http://localhost:3000>.

### 4. Local dev (without Docker)

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run start:dev   # http://localhost:3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173
```

## End-to-end test plan (manual)

1. **Register** a new workspace at `/register` — choose a timezone.
2. **Connect WhatsApp** at `/connect`. Click _Start QR session_, scan the QR with Phone → WhatsApp → Linked devices. Status flips to `connected`.
3. **Sync groups** at `/groups`. The list populates from the linked WhatsApp account.
4. **Create a schedule** at `/schedules/new`:
   - Pick 1–2 groups.
   - Use a near-future cron, e.g. `*/2 * * * *` (every 2 minutes) for testing.
   - Pick your timezone.
5. Watch `/logs` — within ~2 minutes a `pending` row appears, then flips to `sent` (with a `whatsappMessageId`) or `failed` (with `errorReason`).
6. **Pause** the schedule on the list page; verify no further runs.
7. **Resume**; verify firing resumes.
8. **Edit** the schedule (cron / message / groups). Confirm new fan-outs use the updated payload — schedules in flight at the moment of the edit complete with the _previous_ message; subsequent triggers use the new one.
9. **Daily cap**: temporarily set `DAILY_MESSAGE_CAP_PER_TENANT=2` and create a schedule that fires to 5 groups; verify 2 succeed, 3 fail with `daily_cap_exceeded` and are not retried.
10. **Disconnect** WhatsApp at `/connect`; verify `WhatsAppSession` and `WhatsAppAuthKey` rows are wiped for that tenant.

## Behavior notes

- **Edit while in flight**: Each trigger pre-creates `MessageLog` rows in a transaction snapshotting the message text + groups at fire time. Editing the schedule afterwards does _not_ alter messages already enqueued for the current run; only future fan-outs see the new content.
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

| Symptom                                              | Likely cause                                                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Status stays `connecting`, no QR appears             | Backend can't reach WhatsApp servers — check container egress.                                                              |
| QR scans, status flips to `disconnected: logged_out` | The phone refused the link (already too many devices, or banned number). Try a different number.                            |
| Logs stay `pending` forever                          | Worker not running, or Redis unreachable. Check backend logs for `MessageSendProcessor` startup.                            |
| Schedule fires at wrong time                         | Confirm the schedule timezone matches your phone's. `cron-parser` honors the IANA tz of the schedule, not the server clock. |
| `Invalid encryption key` at boot                     | `ENCRYPTION_KEY` is not exactly 64 hex chars (32 bytes). Regenerate with `openssl rand -hex 32`.                            |

## License

Personal/educational use only. **You are solely responsible** for any account bans or other consequences of running this against your WhatsApp account.
