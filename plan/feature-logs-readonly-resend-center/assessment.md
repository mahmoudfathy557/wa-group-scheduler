# Assessment: Make Logs Read-Only and Move Resend Action to Retry Center

**Created**: 2026-06-19  
**Scope**: full-stack

---

## 1. Current Component State

### Backend Processors (BullMQ)

| Processor       | File                            | Purpose                  | Test Coverage | Impact |
| --------------- | ------------------------------- | ------------------------ | ------------- | ------ |
| ScheduleTrigger | `schedule-trigger.processor.ts` | Initiates schedules      | Existing      | Low    |
| MessageSend     | `message-send.processor.ts`     | Sends per-group messages | Existing      | Low    |

### Backend Services

| Service         | File                                       | Purpose                                | Test Coverage | Changes Needed                        |
| --------------- | ------------------------------------------ | -------------------------------------- | ------------- | ------------------------------------- |
| LogsService     | `backend/src/logs/logs.service.ts`         | Lists logs, clear-view, resend support | Existing      | Verify resend coverage only if needed |
| WhatsAppService | `backend/src/whatsapp/whatsapp.service.ts` | Baileys integration                    | Existing      | No change expected                    |

### Backend Controllers

| Controller     | File                                  | Methods                                                       | Test Coverage   |
| -------------- | ------------------------------------- | ------------------------------------------------------------- | --------------- | ----------------------------------------- |
| LogsController | `backend/src/logs/logs.controller.ts` | `GET /logs`, `POST /logs/clear-view`, `POST /logs/:id/resend` | Partial/unknown | May need regression test for resend route |

### Frontend Components

| Component   | File                                   | Purpose                   | Test Status        | Changes Needed                     |
| ----------- | -------------------------------------- | ------------------------- | ------------------ | ---------------------------------- |
| Logs        | `frontend/src/pages/Logs.tsx`          | View logs and act on them | No known page test | Remove action column resend button |
| App routing | `frontend/src/App.tsx` or router setup | Navigation                | Unknown            | Add route/link to retry center     |

### Database Schema

| Table          | File                           | Impact                    | Migration Status |
| -------------- | ------------------------------ | ------------------------- | ---------------- |
| logs           | `backend/prisma/schema.prisma` | No schema change expected | N/A              |
| log_view_state | `backend/prisma/schema.prisma` | No schema change expected | N/A              |

---

## 2. Test Inventory

### Existing Unit Tests

| File                                       | Count            | Coverage | Gaps                                                    |
| ------------------------------------------ | ---------------- | -------- | ------------------------------------------------------- |
| `backend/src/logs/logs.service.spec.ts`    | Existing         | Partial  | May not cover UX-facing resend placement                |
| `backend/src/logs/logs.controller.spec.ts` | Existing/partial | Partial  | May not cover resend endpoint regression after UI split |

### Existing Integration Tests

| Scenario          | File             | Status              | Needs Update                                       |
| ----------------- | ---------------- | ------------------- | -------------------------------------------------- |
| Logs clear-view   | Existing         | Already implemented | No                                                 |
| Log resend action | Existing/unknown | Likely partial      | Maybe, if button removal affects route assumptions |

### Test Cases to Add (TDD Red Phase)

```markdown
**Frontend Tests**:

- [ ] Logs page does not render a resend action
- [ ] Logs page keeps filters and read-only listing
- [ ] Retry center renders actionable entries only
- [ ] Retry center calls resend mutation on click
- [ ] Navigation from logs page to retry center exists

**Backend Regression Tests**:

- [ ] Resend endpoint still accepts log id and tenant-scoped access
- [ ] Logs listing remains unchanged by UI split
```

---

## 3. Breaking Changes & Risks

| Change                                   | Risk Level | Mitigation                                                         |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------ |
| Removing the resend button from Logs.tsx | Low        | Add a new route/page before removing the old control               |
| Introducing a new retry center page      | Medium     | Keep it thin and reuse existing API/query shape                    |
| Route/nav changes                        | Low        | Add direct link from logs page and keep existing logs route stable |

---

## 4. Multi-Tenant Impact

- [x] Tenancy scoping required in new code
- [x] Retry center must only show logs for the current tenant
- [x] Resend action must continue using tenant-scoped auth/context
- [ ] Per-tenant encryption impact expected: none
- [ ] Test with multiple tenants in integration suite if new route logic touches backend queries

---

## 5. Queue/Job Impact

| Job Type         | File                            | Impact | Changes Needed          |
| ---------------- | ------------------------------- | ------ | ----------------------- |
| Schedule Trigger | `schedule-trigger.processor.ts` | None   | None                    |
| Message Send     | `message-send.processor.ts`     | None   | None                    |
| Log Resend       | `backend/src/logs/` resend flow | None   | No job changes expected |

---

## 6. Recommended Approach & Phases

**TDD Strategy**: Red → Green → Refactor

1. **Phase 1 (Red)**: Write page tests that prove the logs view is read-only and the retry center owns the action
2. **Phase 2 (Green)**: Move the resend button into a dedicated page and wire navigation
3. **Phase 3 (Refactor)**: Simplify shared table rendering and keep the UX consistent
4. **Phase 4 (Integration)**: Verify navigation and resend behavior end-to-end
5. **Phase 5 (Docs)**: Update notes if the logs/retry UX changes are user-facing

**Estimated Effort**: 2-4 hours depending on routing and test coverage gaps

---

## 7. Technology Constraints (WA-Scheduler Specific)

- **No horizontal scaling**: Baileys session held in process memory, so UI changes must not imply backend concurrency changes
- **Queue state**: BullMQ/Redis remain unchanged; resend is still an operation on an existing log
- **Tenancy**: All log queries and resend actions must remain tenant-scoped
- **Read-only logs UX**: The main logs surface should not expose operational actions
