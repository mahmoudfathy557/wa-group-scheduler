# Assessment: Event-driven group sync with isLatest + Groups pagination/count

**Created**: 2026-06-20  
**Scope**: full-stack

---

## 1. Current Component State

### Backend Services

| Service         | File                                       | Purpose                                  | Test Coverage          | Changes Needed                                |
| --------------- | ------------------------------------------ | ---------------------------------------- | ---------------------- | --------------------------------------------- |
| WhatsAppService | `backend/src/whatsapp/whatsapp.service.ts` | Baileys socket lifecycle and group fetch | No dedicated spec file | Add `isLatest` wait, timeout/retry robustness |
| GroupsService   | `backend/src/groups/groups.service.ts`     | Sync groups into DB and list groups      | Has spec               | Keep sync contract stable                     |

### Backend Controllers

| Controller       | File                                      | Methods                            | Test Coverage                |
| ---------------- | ----------------------------------------- | ---------------------------------- | ---------------------------- | -------------------------- |
| GroupsController | `backend/src/groups/groups.controller.ts` | `GET /groups`, `POST /groups/sync` | Indirectly via service tests | No API shape change needed |

### Frontend Components

| Component   | File                            | Purpose                          | Test Status                 | Changes Needed                        |
| ----------- | ------------------------------- | -------------------------------- | --------------------------- | ------------------------------------- |
| Groups page | `frontend/src/pages/Groups.tsx` | Display and sync WhatsApp groups | No explicit component tests | Add total count + pagination controls |

### Database Schema

| Table | File                           | Impact           | Migration Status |
| ----- | ------------------------------ | ---------------- | ---------------- |
| group | `backend/prisma/schema.prisma` | No schema change | N/A              |

---

## 2. Test Inventory

### Existing Unit Tests

| File                                        | Count | Coverage             | Gaps                                                                        |
| ------------------------------------------- | ----- | -------------------- | --------------------------------------------------------------------------- |
| `backend/src/groups/groups.service.spec.ts` | 3     | Core list/sync flows | Missing service-level reliability tests for WhatsApp event wait and timeout |

### Test Cases to Add (TDD Red Phase)

- [ ] WhatsApp group fetch retries when first snapshot is empty
- [ ] WhatsApp group fetch respects timeout
- [ ] Groups page pagination logic keeps valid page after sync/list changes

---

## 3. Breaking Changes & Risks

| Change                       | Risk Level | Mitigation                                                 |
| ---------------------------- | ---------- | ---------------------------------------------------------- |
| Add event wait before fetch  | Medium     | Timeout fallback to snapshot fetch when event not observed |
| Add retry around group fetch | Low        | Configurable env defaults and bounded retries              |
| Add pagination in UI         | Low        | Client-side only, backend contract unchanged               |

---

## 4. Multi-Tenant Impact

- [x] Tenant scoping remains enforced in `GroupsService` upsert and list
- [x] No cross-tenant memory cache added
- [x] No change to tenant auth/guards

---

## 5. Queue/Job Impact

| Job Type         | File                                                  | Impact | Changes Needed |
| ---------------- | ----------------------------------------------------- | ------ | -------------- |
| Schedule Trigger | `backend/src/schedules/schedule-trigger.processor.ts` | None   | None           |
| Message Send     | `backend/src/schedules/message-send.processor.ts`     | None   | None           |

---

## 6. Recommended Approach & Phases

1. **Phase 1 (Red)**: Add or plan reliability tests for WhatsApp listGroups behavior
2. **Phase 2 (Green)**: Implement `isLatest` wait + timeout/retry group fetch
3. **Phase 3 (Refactor)**: Improve logs/config parsing helpers
4. **Phase 4 (Integration/UI)**: Add Groups page count + pagination
5. **Phase 5 (Validation)**: Run backend tests and frontend build

**Estimated Effort**: 2-4 hours

---

## 7. Technology Constraints (WA-Scheduler Specific)

- Baileys socket sessions are in-memory per process (single-instance constraint)
- Group fetch completeness depends on WhatsApp Web hydration timing
- Must preserve tenant-safe Prisma usage
- Avoid schema changes for this reliability/UI iteration
