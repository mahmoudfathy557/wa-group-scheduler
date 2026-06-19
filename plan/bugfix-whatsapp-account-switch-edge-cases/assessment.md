# Assessment: WhatsApp Account Switch Edge Cases

**Created**: 2026-06-19  
**Scope**: full-stack

---

## 1. Current Component State

### Backend Processors

| Processor                | File                                                | Purpose                                         | Test Coverage | Impact |
| ------------------------ | --------------------------------------------------- | ----------------------------------------------- | ------------- | ------ |
| ScheduleTriggerProcessor | backend/src/schedules/schedule-trigger.processor.ts | Loads active schedule and fans out pending logs | Exists        | High   |
| MessageSendProcessor     | backend/src/schedules/message-send.processor.ts     | Sends message with tenant lock and retries      | Exists        | High   |
| PendingReconcileService  | backend/src/schedules/pending-reconcile.service.ts  | Requeues stale pending logs                     | Exists        | High   |

### Backend Services

| Service          | File                                       | Purpose                                        | Test Coverage | Changes Needed                        |
| ---------------- | ------------------------------------------ | ---------------------------------------------- | ------------- | ------------------------------------- |
| WhatsAppService  | backend/src/whatsapp/whatsapp.service.ts   | Connect/disconnect and per-tenant socket state | Limited       | Add account-switch behavior tests     |
| GroupsService    | backend/src/groups/groups.service.ts       | Sync groups from connected account             | Limited       | Add stale-group and resync assertions |
| SchedulesService | backend/src/schedules/schedules.service.ts | Lifecycle and repeat jobs                      | Exists        | Validate pause/switch safety flow     |

### Database Schema

| Table           | File                         | Impact                                           | Migration Status           |
| --------------- | ---------------------------- | ------------------------------------------------ | -------------------------- |
| WhatsAppSession | backend/prisma/schema.prisma | One row per tenant session                       | No schema change planned   |
| Group           | backend/prisma/schema.prisma | Group links can become stale after account swap  | No schema change initially |
| MessageLog      | backend/prisma/schema.prisma | Pending retries and failure reason observability | No schema change initially |

---

## 2. Test Inventory

### Existing Unit Tests

| File                                                     | Coverage | Gaps                                                          |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| backend/src/schedules/message-send.processor.spec.ts     | Medium   | Missing disconnect/reconnect transition behavior              |
| backend/src/schedules/pending-reconcile.service.spec.ts  | Medium   | Missing queue unavailable and repeated zero/N cycles          |
| backend/src/schedules/schedule-trigger.processor.spec.ts | Medium   | Missing burst warning and repeated stale trigger verification |

### Test Cases to Add (Red Phase)

Unit Tests:

- [ ] Message send fails gracefully when tenant socket disconnected mid-run
- [ ] Disconnect event auto-pauses all active schedules for tenant
- [ ] Reconcile logs enqueue error details when add fails
- [ ] Trigger processor skips stale trigger safely for paused/deleted schedules
- [ ] Groups sync behavior with old groups remaining and new groups added

Integration Tests:

- [ ] Account switch with active schedules auto-pauses on disconnect and produces no crash
- [ ] Post-switch group sync and schedule remap succeeds
- [ ] Tenant A and tenant B isolation maintained during switch events

Frontend Flow Tests (if supported):

- [ ] Connect/disconnect status transitions surface correct operator hints

---

## 3. Breaking Changes and Risks

| Change                                                          | Risk Level | Mitigation                         |
| --------------------------------------------------------------- | ---------- | ---------------------------------- |
| Auto-pause schedules on disconnect                              | Medium     | Make pause idempotent, add tests   |
| Add stricter behavior during disconnected state                 | Low        | Backward compatible error handling |
| Add operator requirement to sync groups after switching account | Medium     | Document runbook and UI hint       |
| Increase logging around reconcile enqueue failures              | Low        | Keep logs rate-limited and concise |

---

## 4. Multi-Tenant Impact

- Tenant scoping must remain explicit in all reads/writes
- Per-tenant lock behavior in message send must stay intact
- Account switch for one tenant must not impact others

---

## 5. Queue and Job Impact

| Job Type           | File                                                | Impact                                    | Changes Needed                              |
| ------------------ | --------------------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| schedule-trigger   | backend/src/schedules/schedule-trigger.processor.ts | Stale trigger warnings after pause/delete | Clarify/monitor expected frequency          |
| schedule lifecycle | backend/src/schedules/schedules.service.ts          | Auto-pause on disconnect                  | Add disconnect-driven pause hook and tests  |
| message-send       | backend/src/schedules/message-send.processor.ts     | Retries during disconnect windows         | Ensure terminal clarity and bounded retries |
| pending-reconcile  | backend/src/schedules/pending-reconcile.service.ts  | Zero/N queue attempts can hide root cause | Add explicit catch logging                  |

---

## 6. Recommended TDD Approach and Phases

1. Red: Introduce failing tests for disconnect/switch behavior and stale group mapping
2. Green: Implement minimal backend safeguards including auto pause on disconnect
3. Refactor: Clean up helpers and logging noise
4. Integration: Validate end-to-end switch flow
5. Docs: Add switching runbook and edge-case checklist

**Estimated Effort**: 3-5 hours

---

## 7. Constraints

- Single instance runtime for WhatsApp socket state
- One active session per tenant by current schema design
- Redis/BullMQ availability affects enqueue and reconcile behavior
- No schema migration unless tests prove necessity
