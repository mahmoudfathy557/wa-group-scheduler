# Task: Add Manual Message Resend from Logs View with Next Cron Prediction

**Task ID**: `FEATURE-LOGS-MANUAL-RESEND-CRON`  
**Created**: 2026-06-19  
**Type**: feature  
**Scope**: full-stack  
**Status**: ⏳ **Pending Start**

---

## Objective

Enable users to manually resend pending/failed messages directly from the Logs view and display when the next scheduled cron tick will attempt to resend. This reduces wait time for users and improves visibility into retry behavior.

**Target Outcome**:

- Logs table shows "Next retry: YYYY-MM-DD HH:MM" for non-sent messages
- "Resend now" button enqueues immediate send job
- Manual resend respects tenant isolation and anti-ban delay
- Real-time feedback via Socket.IO when manual send completes

---

## Current State Snapshot

| Component | Version/State          | File Path                      | Notes                                               |
| --------- | ---------------------- | ------------------------------ | --------------------------------------------------- |
| Frontend  | React 18 + Vite        | `frontend/src/pages/Logs.tsx`  | Currently shows status + error reason only          |
| Backend   | NestJS 10 + Bull Queue | `backend/src/logs/`            | Logs controller exists, no manual send endpoint     |
| Scheduler | BullMQ + Cron          | `backend/src/schedules/`       | Schedule triggers via cron; no next-tick prediction |
| Database  | Prisma + PostgreSQL 16 | `backend/prisma/schema.prisma` | Messages/Schedules tables exist                     |
| Auth      | JWT (12h expiry)       | `backend/src/auth/`            | Tenant-scoped via CurrentUser decorator             |
| Anti-ban  | 5–10s jitter delay     | `backend/src/whatsapp/`        | Enforced per tenant via Redis lock                  |

---

## Scope: What's Included & Excluded

### ✅ Included

- Frontend column: "Next Retry" showing calculated cron next-run time
- Frontend button: "Resend now" to manually enqueue message send
- Backend endpoint: `POST /logs/:id/resend` to trigger manual send
- Backend logic: Calculate next cron tick from schedule's cron expression
- Tenant isolation: Verify user owns message + schedule before resending
- Real-time feedback: Socket.IO event when manual send job queued
- Tests: Unit (service, controller), integration (E2E flow), multi-tenant

### ❌ Excluded

- Bulk resend (resend multiple messages at once) — scope limited to single-message resend
- Retry history (show previous attempts) — separate feature
- Custom retry delay (user-configurable wait time) — use default anti-ban delay
- Email notifications on manual send — out of scope

---

## TDD Flow Mode

- **Red → Green → Refactor → Repeat**: Write failing test first, implement minimal code, refactor
- **Test Entry Points**:
  - Backend: `logs.service.spec.ts` (cron calculation), `logs.controller.spec.ts` (resend endpoint)
  - Frontend: `Logs.spec.tsx` (column rendering, button click)
- **Approval Gates**: After each phase, verify test suite passes (`npm test`)
- **Integration Points**:
  - Logs controller calls logs service to resend
  - Logs service enqueues message-send processor job
  - Frontend listens to Socket.IO `message:resent` event for feedback

---

## Key Files to Review First

**Frontend**:

- `frontend/src/pages/Logs.tsx` — Current logs table (attachment provided)
- `frontend/src/lib/api.ts` — API client wrapper
- `frontend/src/hooks/` — Custom React Query hooks (if any)

**Backend**:

- `backend/src/logs/logs.controller.ts` — Current logs API
- `backend/src/logs/logs.service.ts` — Log queries (expand for resend logic)
- `backend/src/schedules/schedules.service.ts` — Schedule + cron data
- `backend/src/schedules/message-send.processor.ts` — Message send job (will reuse)
- `backend/src/whatsapp/whatsapp.service.ts` — Anti-ban delay enforcement

**Database**:

- `backend/prisma/schema.prisma` — Message + Schedule tables (review current schema)

**Tests**:

- `backend/src/logs/logs.service.spec.ts` — Add tests for cron calculation + resend
- `backend/src/logs/logs.controller.spec.ts` — Add tests for POST endpoint
- `frontend/src/pages/Logs.spec.tsx` — Add tests for new column + button

---

## Current Test Status

| File                                       | Coverage | Notes                                                        |
| ------------------------------------------ | -------- | ------------------------------------------------------------ |
| `backend/src/logs/logs.service.spec.ts`    | ~60%     | Exists, but no resend logic; will add cron calculation tests |
| `backend/src/logs/logs.controller.spec.ts` | ~70%     | Exists, but no POST /resend endpoint; will add               |
| `frontend/src/pages/Logs.spec.tsx`         | None     | No tests yet; will create with new column + button tests     |

---

## Decisions Log

| Decision                                            | Rationale                                                                           | Status     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| Cron prediction server-side vs. client-side         | Server has access to schedule cron + DB context; client cannot calculate accurately | ⏳ Pending |
| Manual resend as separate endpoint vs. queue-driven | REST endpoint cleaner than direct queue access; rate-limited via backend            | ⏳ Pending |
| Socket.IO event for manual resend feedback          | Real-time UI update without polling; matches project's Socket.IO usage              | ⏳ Pending |
| Single-message resend only (no bulk)                | Simpler UX, lower risk; bulk resend is follow-up feature                            | ⏳ Pending |

---

## Estimated Timeline

- **Phase 1 (Red)**: 30 min — Write failing tests
- **Phase 2 (Green)**: 1 hour — Implement cron calc + resend endpoint + button
- **Phase 3 (Refactor)**: 45 min — Improve error handling, add logging, security audit
- **Phase 4 (Integration)**: 1 hour — E2E flow + multi-tenant test
- **Phase 5 (Docs)**: 15 min — Update README, code comments

**Total**: ~4.25 hours

---

## Technology Constraints (WA-Scheduler Specific)

- **Cron parsing**: Use `cron-parser` npm package (lightweight, zero deps)
- **Next-tick calculation**: Account for timezone (user's browser vs. server)
- **Anti-ban delay**: Manual send must still respect 5–10s jitter between group messages
- **Tenancy**: Every resend must verify `message.schedule.tenantId === currentUser.tenantId`
- **Socket.IO**: Emit event to user's tenant context only (broadcast to tenant, not all clients)
- **Queue state**: Job must be persisted in Redis + logged in DB (audit trail)
