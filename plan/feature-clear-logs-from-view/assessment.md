# Assessment: Add Clear Logs from View Action

**Created**: 2026-06-19  
**Scope**: full-stack

---

## 1. Current Component State

### Backend Processors (BullMQ)

| Processor       | File                                                  | Purpose                       | Test Coverage                      | Impact |
| --------------- | ----------------------------------------------------- | ----------------------------- | ---------------------------------- | ------ |
| ScheduleTrigger | `backend/src/schedules/schedule-trigger.processor.ts` | Enqueues send work            | Existing specs in schedules module | Low    |
| MessageSend     | `backend/src/schedules/message-send.processor.ts`     | Produces `MessageLog` records | Existing specs in schedules module | Low    |

### Backend Services

| Service             | File                                          | Purpose                         | Test Coverage                 | Changes Needed                          |
| ------------------- | --------------------------------------------- | ------------------------------- | ----------------------------- | --------------------------------------- |
| LogsService         | `backend/src/logs/logs.service.ts`            | List and stats for message logs | `logs.service.spec.ts` exists | Add clear marker write + list filtering |
| TenantPrismaService | `backend/src/prisma/tenant-prisma.service.ts` | Tenant-scoped client            | existing tests exist          | Must remain source of all DB access     |

### Backend Controllers

| Controller     | File                                  | Methods                        | Test Coverage                     |
| -------------- | ------------------------------------- | ------------------------------ | --------------------------------- |
| LogsController | `backend/src/logs/logs.controller.ts` | `GET /logs`, `GET /logs/stats` | No dedicated controller spec seen |

### Frontend Components

| Component | File                          | Purpose            | Test Status                         | Changes Needed                            |
| --------- | ----------------------------- | ------------------ | ----------------------------------- | ----------------------------------------- |
| Logs page | `frontend/src/pages/Logs.tsx` | Show + filter logs | No attached tests in prompt context | Add clear button, mutation, cache refresh |

### Database Schema

| Table/Model                     | File                           | Impact                                     | Migration Status        |
| ------------------------------- | ------------------------------ | ------------------------------------------ | ----------------------- |
| `MessageLog`                    | `backend/prisma/schema.prisma` | Rows must remain unchanged/deleted never   | unchanged requirement   |
| New view-state model (proposed) | `backend/prisma/schema.prisma` | store tenant-level/user-level clear cursor | migration likely needed |

---

## 2. Test Inventory

### Existing Unit Tests

| File                                    | Count      | Coverage   | Gaps                                   |
| --------------------------------------- | ---------- | ---------- | -------------------------------------- |
| `backend/src/logs/logs.service.spec.ts` | 1 scenario | stats only | Missing list filter and clear behavior |

### Existing Integration Tests

| Scenario                   | File | Status     | Needs Update |
| -------------------------- | ---- | ---------- | ------------ |
| Logs clear visibility flow | N/A  | Not tested | Yes          |

### Test Cases to Add (TDD Red Phase)

**Unit Tests**:

- [ ] `LogsService.list` excludes records at/before clear marker timestamp
- [ ] `LogsService.clearView` persists/updates tenant clear marker
- [ ] clear operation does not mutate/delete `MessageLog` rows

**Controller/API Tests**:

- [ ] `POST /logs/clear-view` returns success payload
- [ ] `GET /logs` returns filtered result after clear

**Frontend Tests**:

- [ ] clicking clear button triggers mutation call
- [ ] list refreshes and old rows are hidden

**Integration Tests**:

- [ ] tenant A clear action does not affect tenant B list visibility

---

## 3. Breaking Changes & Risks

| Change                                | Risk Level | Mitigation                                                 |
| ------------------------------------- | ---------- | ---------------------------------------------------------- |
| Add new endpoint for clear marker     | Low        | Backward compatible additive API                           |
| Add filter behavior to list query     | Medium     | default clear marker null/no filter preserves old behavior |
| Add DB model/migration for view-state | Medium     | migration tested locally, rollback via migration revert    |

---

## 4. Multi-Tenant Impact

- [x] Tenancy scoping required for clear marker reads/writes
- [x] No cross-tenant leakage in list filtering
- [ ] Decide whether marker is tenant-level or user-level
- [x] Integration test must validate tenant isolation

---

## 5. Queue/Job Impact

| Job Type         | File                                                  | Impact | Changes Needed      |
| ---------------- | ----------------------------------------------------- | ------ | ------------------- |
| Schedule Trigger | `backend/src/schedules/schedule-trigger.processor.ts` | None   | No changes expected |
| Message Send     | `backend/src/schedules/message-send.processor.ts`     | None   | No changes expected |

---

## 6. Recommended Approach & Phases

**Recommended storage pattern**:

- Add a small marker entity (for example `LogViewState`) keyed by tenant (optionally user) with `clearedBeforeOrAt` timestamp.
- On clear action, set marker to current server time.
- On list action, apply `createdAt > clearedBeforeOrAt` filter when marker exists.
- Keep `MessageLog` rows intact.

**TDD Strategy**: Red → Green → Refactor

1. **Phase 1 (Red)**: define failing tests for clear endpoint + list filtering
2. **Phase 2 (Green)**: minimal endpoint/service/schema implementation
3. **Phase 3 (Refactor)**: tighten API shape, tenancy guards, query clarity, docs
4. **Phase 4 (Integration)**: tenant isolation + frontend-backend flow checks
5. **Phase 5 (Docs)**: update feature behavior notes

**Estimated Effort**: 4-6 hours

---

## 7. Technology Constraints (WA-Scheduler Specific)

- No deletion of `MessageLog` rows for this feature
- Tenant isolation must be maintained by tenant-scoped Prisma access
- API should remain backward compatible for existing logs consumers
- UI should continue polling/refetch behavior without race issues after clear
