# Task Checklist: Clear Logs from View Feature

**Status**: ✅ Ready to Execute  
**Total Tasks**: 20  
**Completion Target**: All tasks → ✅ Complete

---

## Phase 1: Red – Write Failing Tests

### 1.1 Write LogsService Tests (Red)

**Status**: ⏳  
**File**: `backend/src/logs/logs.service.spec.ts`  
**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add test: `clearView()` creates LogViewState entry
- [ ] Add test: `list()` filters where createdAt > LogViewState.clearedAt
- [ ] Add test: Multiple clears are idempotent
- [ ] Run `npm test -- logs.service.spec.ts` → expect FAIL
- [ ] Commit: "Test(red): Add clear-view service tests"

---

### 1.2 Write LogsController Tests (Red)

**Status**: ⏳  
**File**: `backend/src/logs/logs.controller.spec.ts`  
**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add test: `POST /logs/clear-view` calls service
- [ ] Add test: Response includes `{ clearedAt, message }`
- [ ] Add test: GET returns empty if all logs pre-clear
- [ ] Run `npm test -- logs.controller.spec.ts` → expect FAIL
- [ ] Commit: "Test(red): Add clear-view controller tests"

---

### 1.3 Write Frontend Component Tests (Red)

**Status**: ⏳  
**File**: `frontend/src/pages/Logs.spec.tsx`  
**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add test: Clear button renders
- [ ] Add test: Dialog shows on button click
- [ ] Add test: Calls POST /logs/clear-view on confirm
- [ ] Add test: Refetches logs after clear
- [ ] Run `npm test -- Logs.spec.tsx` → expect FAIL
- [ ] Commit: "Test(red): Add clear logs frontend tests"

---

### 1.4 Write Integration Test (Red)

**Status**: ⏳  
**File**: `backend/tests/integration/logs-clear-view.e2e.spec.ts`  
**TDD Step**: 📌 Red

**Checklist**:

- [ ] Create integration test file
- [ ] Add test: Full flow (create logs → clear → filter works)
- [ ] Add test: Multi-tenant isolation (Tenant A ≠ B)
- [ ] Run test → expect FAIL
- [ ] Commit: "Test(red): Add integration test for clear-view"

---

**Phase 1 Exit Criteria**: ✅ All tests failing (red)

---

## Phase 2: Green – Implement Minimal Code

### 2.1 Add LogViewState to Schema

**Status**: ⏳  
**File**: `backend/prisma/schema.prisma`  
**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add model:
  ```prisma
  model LogViewState {
    id        String   @id @default(cuid())
    tenantId  String   @unique
    clearedAt DateTime @default(now())
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }
  ```
- [ ] Run `npx prisma migrate dev --name add_log_view_state`
- [ ] Verify migration created
- [ ] Commit: "Db: Add LogViewState model"

---

### 2.2 Implement LogsService.clearView()

**Status**: ⏳  
**File**: `backend/src/logs/logs.service.ts`  
**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add method: `async clearView(tenantId: string)`
- [ ] Use `upsert` to create/update LogViewState
- [ ] Return `{ clearedAt: new Date(), message: 'Logs cleared' }`
- [ ] Run `npm test -- logs.service.spec.ts` → expect PASS
- [ ] Commit: "Feat: Implement clearView method"

---

### 2.3 Update LogsService.list() Filter

**Status**: ⏳  
**File**: `backend/src/logs/logs.service.ts`  
**TDD Step**: 📗 Green

**Checklist**:

- [ ] Modify `list()` to check LogViewState
- [ ] Add filter: `where: { tenantId, createdAt: { gt: logViewState?.clearedAt } }`
- [ ] Run `npm test -- logs.service.spec.ts` → expect PASS
- [ ] Commit: "Feat: Filter logs by clear marker"

---

### 2.4 Implement LogsController.clearView()

**Status**: ⏳  
**File**: `backend/src/logs/logs.controller.ts`  
**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add `@Post('clear-view')` endpoint
- [ ] Inject LogsService
- [ ] Call `logsService.clearView(currentUser.tenantId)`
- [ ] Return response
- [ ] Run `npm test -- logs.controller.spec.ts` → expect PASS
- [ ] Commit: "Feat: Add POST /logs/clear-view endpoint"

---

### 2.5 Implement Frontend Clear Button

**Status**: ⏳  
**File**: `frontend/src/pages/Logs.tsx`  
**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add button: "Clear Logs"
- [ ] Add confirmation dialog (create separate component)
- [ ] On confirm: call `POST /logs/clear-view`
- [ ] Refetch logs list
- [ ] Run `npm test -- Logs.spec.tsx` → expect PASS
- [ ] Commit: "Feat: Add clear logs button"

---

### 2.6 Run Full Test Suite

**Status**: ⏳

**Checklist**:

- [ ] Run `npm test` (backend) → all PASS
- [ ] Run `npm test` (frontend) → all PASS
- [ ] Commit: "Test: All Phase 2 tests passing"

---

**Phase 2 Exit Criteria**: ✅ All tests passing

---

## Phase 3: Refactor – Improve Code Quality

### 3.1 Service Refactor

**Status**: ⏳  
**File**: `backend/src/logs/logs.service.ts`

**Checklist**:

- [ ] Extract filter logic to helper: `buildLogsFilter(tenantId)`
- [ ] Add logging: `this.logger.debug('Clearing logs...')`
- [ ] Add error handling: `try-catch` with custom exception
- [ ] Add JSDoc comments
- [ ] Run tests → expect PASS
- [ ] Commit: "Refactor: Improve service clarity"

---

### 3.2 Controller Refactor

**Status**: ⏳  
**File**: `backend/src/logs/logs.controller.ts`

**Checklist**:

- [ ] Add OpenAPI decorators: `@ApiOperation()`, `@ApiResponse()`
- [ ] Create DTO: `ClearViewResponseDto`
- [ ] Validate tenant context
- [ ] Run tests → expect PASS
- [ ] Commit: "Refactor: Add OpenAPI documentation"

---

### 3.3 Frontend Component Refactor

**Status**: ⏳  
**File**: `frontend/src/pages/Logs.tsx` + `ClearLogsDialog.tsx`

**Checklist**:

- [ ] Extract dialog to separate component
- [ ] Add error toast on failure
- [ ] Add loading state
- [ ] Memoize handlers
- [ ] Add accessibility labels
- [ ] Run tests → expect PASS
- [ ] Commit: "Refactor: Improve component UX"

---

### 3.4 Security Audit

**Status**: ⏳

**Checklist**:

- [ ] Verify tenant scoping (LogViewState.tenantId)
- [ ] Verify `@CurrentUser()` guard on endpoint
- [ ] Verify no hardcoded secrets
- [ ] Verify error messages safe
- [ ] Run all tests → expect PASS
- [ ] Commit: "Security: Audit clear-view feature"

---

## Phase 4: Integration Tests

### 4.1 Run E2E Test

**Status**: ⏳  
**File**: `backend/tests/integration/logs-clear-view.e2e.spec.ts`

**Checklist**:

- [ ] Run test → expect PASS
- [ ] Verify logs filtered correctly
- [ ] Verify old logs preserved in DB
- [ ] Commit: "Test(integration): E2E flow validated"

---

### 4.2 Multi-Tenant Test

**Status**: ⏳

**Checklist**:

- [ ] Verify Tenant A clear ≠ Tenant B logs
- [ ] Verify no cross-tenant data leakage
- [ ] Run test → expect PASS
- [ ] Commit: "Test(security): Multi-tenant isolation verified"

---

## Phase 5: Documentation

### 5.1 Update Docs

**Status**: ⏳

**Checklist**:

- [ ] Update README: add POST /logs/clear-view endpoint
- [ ] Add code comments/JSDoc
- [ ] Commit: "Docs: Update documentation"

---

### 5.2 Final Self-Review

**Status**: ⏳

**Checklist**:

- [ ] All tests passing
- [ ] No console errors
- [ ] Code follows patterns
- [ ] Multi-tenant verified
- [ ] Ready for merge

---

## Summary

| Phase          | Tasks   | Status | Duration |
| -------------- | ------- | ------ | -------- |
| 1: Red         | 1.1–1.4 | ⏳     | 1h       |
| 2: Green       | 2.1–2.6 | ⏳     | 1.5h     |
| 3: Refactor    | 3.1–3.4 | ⏳     | 1h       |
| 4: Integration | 4.1–4.2 | ⏳     | 45m      |
| 5: Docs        | 5.1–5.2 | ⏳     | 15m      |
| **Total**      | **20**  | **⏳** | **~4h**  |

- [ ] Add test: clear does not modify existing `MessageLog` fields
- [ ] Run backend logs spec and verify fail

### 1.2 Add failing controller tests for clear endpoint

**Status**: ⏳  
**File**: `backend/src/logs/logs.controller.spec.ts`  
**TDD Step**: 📌 Red

- [ ] Create spec if missing
- [ ] Add failing test for `POST /logs/clear-view`
- [ ] Add failing test for follow-up list behavior
- [ ] Run and verify fail

### 1.3 Add failing frontend logs-page tests

**Status**: ⏳  
**File**: `frontend/src/pages/Logs.spec.tsx`  
**TDD Step**: 📌 Red

- [ ] Add failing test for clear button rendering
- [ ] Add failing test for clear click -> API call
- [ ] Add failing test for hidden previous rows after refresh

### 1.4 Add failing integration test for tenant isolation

**Status**: ⏳  
**File**: `backend/tests/integration/logs-clear-view.e2e.spec.ts`  
**TDD Step**: 📌 Red

- [ ] Tenant A clear must not affect tenant B
- [ ] Run and verify fail

**Phase 1 Exit**: all new tests are failing for missing implementation

---

## Phase 2: Green – Implement Minimal Code

### 2.1 Add persistence for clear marker

**Status**: ⏳  
**Files**: `backend/prisma/schema.prisma`, `backend/prisma/migrations/...`  
**TDD Step**: 📗 Green

- [ ] Add marker model or chosen persistence field
- [ ] Run migration
- [ ] Keep `MessageLog` rows untouched

### 2.2 Implement clear/list filter service logic

**Status**: ⏳  
**File**: `backend/src/logs/logs.service.ts`  
**TDD Step**: 📗 Green

- [ ] Implement clear marker write method
- [ ] Implement list filter based on marker timestamp
- [ ] Run service tests -> pass

### 2.3 Implement clear endpoint

**Status**: ⏳  
**File**: `backend/src/logs/logs.controller.ts`  
**TDD Step**: 📗 Green

- [ ] Add `POST /logs/clear-view`
- [ ] Return stable response payload
- [ ] Run controller tests -> pass

### 2.4 Implement clear button in logs page

**Status**: ⏳  
**File**: `frontend/src/pages/Logs.tsx`  
**TDD Step**: 📗 Green

- [ ] Add clear button next to refresh
- [ ] Hook mutation to new endpoint
- [ ] Refetch/invalidate logs query after success
- [ ] Show loading/disabled state while clearing
- [ ] Run frontend tests -> pass

### 2.5 Run targeted suites

**Status**: ⏳  
**TDD Step**: 📗 Green

- [ ] Backend logs tests pass
- [ ] Frontend logs tests pass
- [ ] No failing tests from new scope

**Phase 2 Exit**: all phase-1 tests pass

---

## Phase 3: Refactor – Improve Code Quality

### 3.1 Refactor backend logs service

**Status**: ⏳  
**File**: `backend/src/logs/logs.service.ts`  
**TDD Step**: 🔧 Refactor

- [ ] Simplify query composition
- [ ] Add clear comments for marker logic
- [ ] Keep tests green

### 3.2 Refactor frontend UX states

**Status**: ⏳  
**File**: `frontend/src/pages/Logs.tsx`  
**TDD Step**: 🔧 Refactor

- [ ] Improve button text/states
- [ ] Add failure message path for clear action
- [ ] Keep tests green

### 3.3 Security and tenancy audit

**Status**: ⏳  
**Files**: logs module + prisma access paths  
**TDD Step**: 🔧 Refactor

- [ ] Verify tenant-scoped marker read/write
- [ ] Verify no cross-tenant leakage
- [ ] Verify no deletion/update of existing log payload fields

### 3.4 Full test pass in touched areas

**Status**: ⏳  
**TDD Step**: 🔧 Refactor

- [ ] Re-run backend + frontend tests for affected modules
- [ ] Confirm stable passing results

**Phase 3 Exit**: quality improved, tests still green

---

## Phase 4: Integration Tests

### 4.1 Validate end-to-end clear flow

**Status**: ⏳  
**File**: `backend/tests/integration/logs-clear-view.e2e.spec.ts`

- [ ] Generate records
- [ ] Call clear endpoint
- [ ] Assert list hides pre-clear records

### 4.2 Validate tenant isolation in integration

**Status**: ⏳

- [ ] Assert tenant A clear does not hide tenant B records

### 4.3 Validate filtering + status compatibility

**Status**: ⏳

- [ ] Ensure status filter still works with clear marker active

**Phase 4 Exit**: integration behavior verified

---

## Phase 5: Documentation & Finalization

### 5.1 Update task artifacts

**Status**: ⏳

- [ ] Fill execution-log timeline with actual commands/results
- [ ] Record final design decision (marker model)

### 5.2 Final readiness checklist

**Status**: ⏳

- [ ] Requirement met: hidden from page only
- [ ] Requirement met: logs still exist in DB
- [ ] Tests passing for all new behavior
- [ ] Ready for PR

---

## Task Dependencies

```text
1.1 -> 2.2 -> 3.1 -> 4.1 -> 5.2
1.2 -> 2.3 -> 3.3 -> 4.2 -> 5.2
1.3 -> 2.4 -> 3.2 -> 4.3 -> 5.2
1.4 -----------------> 4.2 -> 5.2
2.1 -> 2.2
2.5 depends on 2.2, 2.3, 2.4
```
