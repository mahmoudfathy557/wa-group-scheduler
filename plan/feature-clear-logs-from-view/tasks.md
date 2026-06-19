# Task Checklist: Add Clear Logs from View Action

**Status**: ⏳ Ready to Start  
**Total Tasks**: 18  
**Completion Target**: clear action hides old logs from page without deleting DB rows

---

## Legend

- ⏳ Not Started
- 🔄 In Progress
- ✅ Complete
- ⚠️ Blocked
- 📌 TDD Red
- 📗 TDD Green
- 🔧 TDD Refactor

---

## Phase 1: Red – Write Failing Tests

### 1.1 Add failing service tests for clear marker

**Status**: ⏳  
**File**: `backend/src/logs/logs.service.spec.ts`  
**TDD Step**: 📌 Red

- [ ] Add test: list hides logs created at/before marker
- [ ] Add test: clear method upserts marker
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
