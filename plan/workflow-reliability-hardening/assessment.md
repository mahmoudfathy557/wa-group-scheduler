# Assessment: Schedule Workflow Reliability Hardening

**Date**: 2026-06-19  
**Scope**: backend  
**Status**: Initial Assessment

---

## 1. Current Component State

### Backend Processors (BullMQ)

| Processor         | File                                                                                                       | Purpose                                       | Test Coverage          | Impact |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------- | ------ |
| Schedule Trigger  | [backend/src/schedules/schedule-trigger.processor.ts](backend/src/schedules/schedule-trigger.processor.ts) | Fan-out one schedule tick into per-group jobs | Existing spec coverage | High   |
| Message Send      | [backend/src/schedules/message-send.processor.ts](backend/src/schedules/message-send.processor.ts)         | Per-group send, pacing, lock, retry           | Existing spec coverage | High   |
| Pending Reconcile | [backend/src/schedules/pending-reconcile.service.ts](backend/src/schedules/pending-reconcile.service.ts)   | Requeue stale pending logs                    | Existing spec coverage | Medium |
| Run Completeness  | [backend/src/schedules/run-completeness.service.ts](backend/src/schedules/run-completeness.service.ts)     | Repair incomplete runs                        | Existing spec coverage | Medium |

### Backend Services

| Service            | File                                                                                     | Purpose                                       | Test Coverage          | Changes Needed                                        |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------- | ----------------------------------------------------- |
| SchedulesService   | [backend/src/schedules/schedules.service.ts](backend/src/schedules/schedules.service.ts) | Register repeat jobs and manage schedules     | Existing spec coverage | Startup rehydrate flow needs explicit validation      |
| LogsService        | [backend/src/logs/logs.service.ts](backend/src/logs/logs.service.ts)                     | Backlog health stats                          | Existing spec coverage | Verify stats stay aligned with recovery states        |
| LogsCleanupService | [backend/src/logs/logs-cleanup.service.ts](backend/src/logs/logs-cleanup.service.ts)     | Retention policy for sent/failed/pending logs | Existing spec coverage | Keep pending retention window long enough for healing |

### Backend Controllers

| Controller          | File                                                                                           | Methods                                    | Test Coverage     |
| ------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------- | -------------------------- |
| SchedulesController | [backend/src/schedules/schedules.controller.ts](backend/src/schedules/schedules.controller.ts) | list/get/create/update/remove/pause/resume | Existing coverage | No direct changes expected |
| LogsController      | [backend/src/logs/logs.controller.ts](backend/src/logs/logs.controller.ts)                     | list/stats                                 | Existing coverage | No direct changes expected |

### Database Schema

| Table      | File                                                         | Impact                                                       | Migration Status |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ---------------- |
| MessageLog | [backend/prisma/schema.prisma](backend/prisma/schema.prisma) | Unique run/group tracking and status indexes already applied | Applied          |
| Schedule   | [backend/prisma/schema.prisma](backend/prisma/schema.prisma) | Repeat-job key and recovery metadata already in place        | Applied          |

---

## 2. Test Inventory

### Existing Unit Tests

| File                                                       | Count              | Coverage | Gaps                                                |
| ---------------------------------------------------------- | ------------------ | -------- | --------------------------------------------------- |
| `backend/src/schedules/message-send.processor.spec.ts`     | Existing           | Good     | Startup/recovery blind spots are not the main focus |
| `backend/src/schedules/pending-reconcile.service.spec.ts`  | Existing           | Good     | Could add duplicate-control edge case               |
| `backend/src/schedules/run-completeness.service.spec.ts`   | Existing           | Good     | Could add startup-rehydrate companion path          |
| `backend/src/schedules/schedule-trigger.processor.spec.ts` | Existing           | Good     | Already covers bulk enqueue and fallback            |
| `backend/src/logs/logs.service.spec.ts`                    | Existing or needed | Moderate | Recovery-facing stats should be asserted explicitly |

### Existing Integration Tests

| Scenario               | File                                                                                                                 | Status  | Needs Update                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- |
| Trigger → send fan-out | [backend/src/schedules/schedule-trigger.processor.spec.ts](backend/src/schedules/schedule-trigger.processor.spec.ts) | Covered | Add recovery-related assertions if needed |
| Recovery cron loops    | `backend/src/schedules/*.spec.ts`                                                                                    | Partial | Add startup / restart behavior            |

### Test Cases to Add (Red Phase)

- [ ] `SchedulesService.rehydrateRepeats` restores repeat jobs for active schedules after startup
- [ ] `PendingReconcileService` remains bounded and does not amplify duplicate requeues
- [ ] `RunCompletenessService` repairs only missing run/group rows and is idempotent
- [ ] `LogsService.stats` continues to expose stale/pending recovery health counts

---

## 3. Breaking Changes & Risks

| Change                            | Risk Level | Mitigation                                            |
| --------------------------------- | ---------- | ----------------------------------------------------- |
| Startup repeat-job rehydrate      | Medium     | Keep it idempotent and test active schedules only     |
| Tightening stale-pending handling | Medium     | Preserve unique job IDs and bounded scan windows      |
| Completeness repair behavior      | Medium     | Repair only missing rows and keep tenant scope intact |
| Stats contract verification       | Low        | Read-only change, no API shape changes expected       |

---

## 4. Multi-Tenant Impact

- [x] Tenant scoping required in new code is already handled by the existing Prisma tenant patterns.
- [ ] Startup rehydrate must remain tenant-safe if invoked from app bootstrap.
- [ ] Recovery jobs must not cross tenant boundaries.
- [ ] Validate behavior with more than one tenant in tests if a new code path is added.

---

## 5. Queue/Job Impact

| Job Type          | File                                                                                                       | Impact   | Changes Needed                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------- |
| Schedule Trigger  | [backend/src/schedules/schedule-trigger.processor.ts](backend/src/schedules/schedule-trigger.processor.ts) | Existing | Keep fallback enqueue visibility consistent          |
| Message Send      | [backend/src/schedules/message-send.processor.ts](backend/src/schedules/message-send.processor.ts)         | Existing | Preserve anti-ban pacing and pending retry semantics |
| Pending Reconcile | [backend/src/schedules/pending-reconcile.service.ts](backend/src/schedules/pending-reconcile.service.ts)   | Existing | Keep bounded requeue behavior                        |
| Run Completeness  | [backend/src/schedules/run-completeness.service.ts](backend/src/schedules/run-completeness.service.ts)     | Existing | Keep repairs idempotent                              |

---

## 6. Recommended Approach & Phases

**TDD Strategy**: Red → Green → Refactor

1. **Phase 1 (Red)**: Write failing tests for startup recovery and recovery-loop safety.
2. **Phase 2 (Green)**: Implement the smallest code changes to make the tests pass.
3. **Phase 3 (Refactor)**: Improve readability, comments, and helper extraction without changing behavior.
4. **Phase 4 (Integration)**: Validate restart recovery and recovery-loop behavior end to end.
5. **Phase 5 (Docs)**: Refresh workflow docs and close the task.

**Estimated Effort**: 2-4 hours

---

## 7. Technology Constraints (WA-Scheduler Specific)

- **No horizontal scaling**: Baileys session stays in process memory.
- **Queue state is transient**: BullMQ jobs can disappear from Redis after restarts if not rehydrated.
- **Recovery must be idempotent**: cron loops should avoid runaway duplicate enqueueing.
- **Tenancy is mandatory**: all queries must stay scoped to the current tenant.
- **Anti-ban behavior stays intact**: do not loosen send pacing or tenant locks while fixing recovery.
