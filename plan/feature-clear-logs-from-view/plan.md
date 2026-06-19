# Execution Plan: Add Clear Logs from View Action

**Status**: Ready for Execution  
**Target Duration**: 4-6 hours  
**Approval Gate**: after each phase, targeted tests must pass

---

## Phase 1: Red – Write Failing Tests

**Objective**: Define expected clear-from-view behavior through failing tests.

**Duration**: 1.5 hours

### Tasks

1. **Logs Service Tests (Red)**

- **File**: `backend/src/logs/logs.service.spec.ts`
- Add failing tests:
  - list excludes logs at/before clear marker
  - clear marker upsert works
  - clear does not delete/update `MessageLog` rows
- Run backend spec and capture failures.

2. **Logs Controller/API Tests (Red)**

- **File**: `backend/src/logs/logs.controller.spec.ts` (create if missing)
- Add failing tests for `POST /logs/clear-view` and subsequent `GET /logs` expectations.

3. **Frontend Logs Page Tests (Red)**

- **File**: `frontend/src/pages/Logs.spec.tsx` (or project-equivalent)
- Add failing tests for clear button click, mutation call, and hidden old rows.

4. **Integration Test Draft (Red)**

- **File**: `backend/tests/integration/logs-clear-view.e2e.spec.ts` (create if needed)
- Add failing scenario for tenant isolation.

### Deliverable

- all new tests fail for missing behavior, with explicit assertions tied to requirements

---

## Phase 2: Green – Implement Minimal Code

**Objective**: Make phase-1 tests pass with minimal implementation.

**Duration**: 1.5-2 hours

### Tasks

1. **Schema/Migration (if using marker table)**

- **Files**:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/<timestamp>_add_log_view_state/migration.sql`
- Add marker model and run migration.

2. **Backend Service Implementation**

- **File**: `backend/src/logs/logs.service.ts`
- Add:
  - `clearView(...)` method storing clear marker
  - list query filter based on marker timestamp

3. **Backend Controller Implementation**

- **File**: `backend/src/logs/logs.controller.ts`
- Add clear endpoint (for example `POST /logs/clear-view`) and wire to service.

4. **Frontend Implementation**

- **File**: `frontend/src/pages/Logs.tsx`
- Add clear button + mutation + query invalidation/refetch.
- UX detail: disable button during request, show transient success/error state.

5. **Run Targeted Tests**

- backend logs service/controller tests pass
- frontend logs page tests pass

### Deliverable

- All red tests now green, with minimal code only

---

## Phase 3: Refactor – Improve Code Quality & Safety

**Objective**: keep tests green while improving clarity, tenancy safety, and UX consistency.

**Duration**: 1 hour

### Tasks

1. Refactor service query construction for readability.
2. Ensure controller validation and consistent response format.
3. Ensure clear action is idempotent.
4. Tighten frontend state handling (loading/error/success).
5. Re-run full module tests.

### Deliverable

- cleaner code paths; no behavior regressions

---

## Phase 4: Integration Tests – Validate End-to-End

**Objective**: verify cross-layer behavior and tenant isolation.

**Duration**: 45-60 minutes

### Tasks

1. **E2E clear-view flow**

- create logs, clear view, verify list hides pre-clear logs.

2. **Multi-tenant isolation**

- clear in tenant A does not affect tenant B visible list.

3. **Regression checks**

- status filtering still works with clear marker active.

### Deliverable

- Integration tests pass consistently

---

## Phase 5: Documentation & Cleanup

**Objective**: update task docs and capture final verification artifacts.

**Duration**: 30 minutes

### Tasks

1. Update behavior notes in docs where applicable.
2. Finalize execution log with test snapshots.
3. Final self-review checklist and merge readiness.

### Deliverable

- Ready for implementation PR review

---

## Summary Table

| Phase          | Tests         | Duration | Gate                          |
| -------------- | ------------- | -------- | ----------------------------- |
| 1: Red         | write failing | 1.5h     | all expected failures present |
| 2: Green       | make passing  | 1.5-2h   | all targeted tests green      |
| 3: Refactor    | keep passing  | 1h       | quality/security checks pass  |
| 4: Integration | full flow     | 45-60m   | E2E + tenant isolation pass   |
| 5: Docs        | finalize      | 30m      | execution artifacts complete  |

**Total**: 4-6 hours
