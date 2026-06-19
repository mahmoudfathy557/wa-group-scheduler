# Task: Schedule Workflow Reliability Hardening

**Task ID**: BUG-WORKFLOW-RELIABILITY  
**Created**: 2026-06-19  
**Type**: Bugfix  
**Scope**: backend  
**Status**: 🔄 **In Progress**

---

## Objective

Eliminate the remaining workflow gaps that can still cause missed sends, duplicate requeues, or recovery blind spots under load.

**Target Outcome**: Schedule runs remain complete and recoverable even after Redis restarts, transient enqueue failures, or delayed processing.

---

## Current State Snapshot

| Component | Version/State                      | File Path                      | Notes                                      |
| --------- | ---------------------------------- | ------------------------------ | ------------------------------------------ |
| Framework | NestJS 10 + BullMQ                 | `backend/`                     | Queue-based scheduling and message sending |
| Database  | Prisma + PostgreSQL 16             | `backend/prisma/schema.prisma` | MessageLog is source of truth              |
| Messaging | Baileys WhatsApp integration       | `backend/src/whatsapp/`        | Single-process session state               |
| Frontend  | React 18 + Vite                    | `frontend/src/`                | Receives Socket.IO updates                 |
| Auth      | JWT tenant-scoped                  | `backend/src/auth/`            | Tenancy enforced in app layer              |
| Recovery  | Pending + completeness reconcilers | `backend/src/schedules/`       | Repair loops already present               |

---

## Progress Snapshot

| Phase                | Status      |
| -------------------- | ----------- |
| Phase 1: Red         | ✅ Complete |
| Phase 2: Green       | ✅ Complete |
| Phase 3: Refactor    | ✅ Complete |
| Phase 4: Integration | ✅ Complete |
| Phase 5: Docs        | ✅ Complete |

---

## Scope: What's Included & Excluded

### ✅ Included

- Startup rehydration for repeatable schedule jobs
- Reduce duplicate pending requeue pressure in stale-pending reconciliation
- Tighten enqueue-failure compensation visibility
- Validate completeness recovery when runs are partially or fully missing
- Unit tests for workflow recovery and startup behavior
- Execution-log tracking for each TDD phase

### ❌ Excluded

- UI redesign
- New messaging features
- Changes to WhatsApp payload format
- Database schema redesign unless a test proves it is required

---

## TDD Flow Mode

- **Red → Green → Refactor → Repeat**: write failing tests first, then implement the smallest fix, then tighten behavior
- **Test Entry Points**: `.spec.ts` files in `backend/src/schedules/`
- **Approval Gates**: review execution-log.md after each phase before moving on
- **Integration Points**: schedule creation, queue trigger, send worker, reconciliation loops, stats/cleanup

---

## Key Files to Review First

- Current workflow code: [backend/src/schedules/schedules.service.ts](backend/src/schedules/schedules.service.ts)
- Trigger processor: [backend/src/schedules/schedule-trigger.processor.ts](backend/src/schedules/schedule-trigger.processor.ts)
- Send worker: [backend/src/schedules/message-send.processor.ts](backend/src/schedules/message-send.processor.ts)
- Recovery services: [backend/src/schedules/pending-reconcile.service.ts](backend/src/schedules/pending-reconcile.service.ts), [backend/src/schedules/run-completeness.service.ts](backend/src/schedules/run-completeness.service.ts)
- Logs: [backend/src/logs/logs.service.ts](backend/src/logs/logs.service.ts), [backend/src/logs/logs-cleanup.service.ts](backend/src/logs/logs-cleanup.service.ts)

---

## Current Test Status

| File                                 | Coverage | Notes                                      |
| ------------------------------------ | -------- | ------------------------------------------ |
| `message-send.processor.spec.ts`     | Existing | Covers lock contention and retry behavior  |
| `pending-reconcile.service.spec.ts`  | Existing | Covers stale pending requeue               |
| `run-completeness.service.spec.ts`   | Existing | Covers missing group repair                |
| `schedule-trigger.processor.spec.ts` | Existing | Covers bulk enqueue and fallback behavior  |
| `schedules.service.spec.ts`          | Existing | May need startup/repeat rehydrate coverage |

---

## Decisions Log

| Decision                               | Rationale                                                                         | Status     |
| -------------------------------------- | --------------------------------------------------------------------------------- | ---------- |
| Rehydrate repeats on startup           | Redis/Bull state is transient, so active schedules must be restored after restart | ⏳ Pending |
| Limit duplicate stale-pending requeues | Prevent queue amplification and lock contention                                   | ⏳ Pending |
| Strengthen completion blind spots      | Ensure missing runs can still be healed or at least detected                      | ⏳ Pending |
