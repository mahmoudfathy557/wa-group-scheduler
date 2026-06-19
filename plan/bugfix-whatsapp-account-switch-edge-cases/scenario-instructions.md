# Task: Harden WhatsApp Account Switch Edge Cases

**Task ID**: BUG-WA-ACCOUNT-SWITCH  
**Created**: 2026-06-19  
**Type**: bugfix  
**Scope**: full-stack  
**Status**: ⏳ Pending Start

---

## Objective

Prevent stale queue jobs, stale group mappings, and noisy warning loops when a tenant disconnects one WhatsApp account and reconnects with a different account.

**Target Outcome**: Account switching is predictable, tenant-safe, and does not leave long-lived pending logs or broken schedule-group mappings.

---

## Current State Snapshot

| Component        | Version/State                         | File Path                                | Notes                                       |
| ---------------- | ------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Framework        | NestJS 10 + BullMQ                    | backend/                                 | Trigger and send workers are queue-driven   |
| Database         | Prisma + PostgreSQL 16                | backend/prisma/schema.prisma             | One WhatsApp session per tenant             |
| WhatsApp Session | Single active socket per tenant       | backend/src/whatsapp/whatsapp.service.ts | Reconnect replaces tenant session           |
| Scheduling       | Trigger + send + reconcile processors | backend/src/schedules/                   | Uses pending/sent/failed logs               |
| Frontend         | React + Vite                          | frontend/src/                            | User can connect/disconnect and sync groups |

---

## Scope: Included and Excluded

### Included

- Define and validate edge-case behavior for account switching
- Automatically pause all active schedules when tenant session is disconnected
- Backend test coverage for trigger, send, and reconcile behavior during switch windows
- Group sync consistency rules after account swap
- Operator runbook steps for safe switching

### Excluded

- Multi-session WhatsApp support per tenant
- New queue technology or worker runtime changes
- Full UI redesign

---

## Policy: Auto Pause on Disconnect

- On tenant WhatsApp disconnect, active schedules for that tenant are auto-paused.
- Trigger and send workers should stop producing new sends for those paused schedules.
- Resume is explicit and should happen only after reconnect + group sync/remap.
- The pause action should be idempotent and safe under repeated disconnect events.

---

## TDD Flow Mode

- Red -> Green -> Refactor -> Repeat
- Test entry points:
  - backend/src/schedules/message-send.processor.spec.ts
  - backend/src/schedules/pending-reconcile.service.spec.ts
  - backend/src/schedules/schedule-trigger.processor.spec.ts
  - backend/src/groups/groups.service.spec.ts (create if missing)
  - frontend tests for connect/disconnect flow (if available)
- Approval gate: Each phase closes only after tests pass and execution-log is updated

---

## Key Files to Review First

- backend/src/whatsapp/whatsapp.service.ts
- backend/src/schedules/message-send.processor.ts
- backend/src/schedules/pending-reconcile.service.ts
- backend/src/schedules/schedule-trigger.processor.ts
- backend/src/groups/groups.service.ts
- backend/prisma/schema.prisma

---

## Current Test Status

| File                               | Coverage | Notes                                                    |
| ---------------------------------- | -------- | -------------------------------------------------------- |
| message-send.processor.spec.ts     | Partial  | Needs account-switch disconnection cases                 |
| pending-reconcile.service.spec.ts  | Partial  | Needs enqueue-failure observability case                 |
| schedule-trigger.processor.spec.ts | Partial  | Has missing/paused coverage, verify race volume behavior |
| groups.service tests               | Unknown  | Need stale group and resync behavior tests               |

---

## Decisions Log

| Decision                                     | Rationale                                  | Status             |
| -------------------------------------------- | ------------------------------------------ | ------------------ |
| Keep one WA session per tenant               | Matches current schema and service model   | ✅ Confirmed       |
| Auto-pause active schedules on disconnect    | Prevent retry storms and pending buildup   | ⏳ Pending rollout |
| Require group re-sync after account switch   | Group membership is account-bound          | ⏳ Pending rollout |
| Add explicit handling docs for switch window | Reduce operator confusion and false alarms | ⏳ Pending         |
