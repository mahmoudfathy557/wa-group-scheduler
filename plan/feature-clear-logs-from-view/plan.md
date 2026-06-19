# Execution Plan: Clear Logs from View Feature

**Status**: Ready for Execution  
**Target Duration**: 4 hours  
**Approval Gate**: After each phase complete all tests pass

---

## Phase 1: Red – Write Failing Tests

**Objective**: Define expected clear-from-view behavior through failing tests.

**Duration**: 1 hour

### Tasks

1. **Write Logs Service Tests (Red)**
   - **File**: `backend/src/logs/logs.service.spec.ts`
   - **Tests to add**:
     - `should create LogViewState for tenant on clear()`
     - `should filter logs where createdAt > clearedAt`
     - `should return empty list if all logs pre-clear`
     - `should preserve LogViewState on multiple clears (idempotent)`

2. **Write Logs Controller Tests (Red)**
   - **File**: `backend/src/logs/logs.controller.spec.ts`
   - **Tests to add**:
     - `POST /logs/clear-view should call service.clearView()`
     - `POST /logs/clear-view should return { clearedAt, message }`
     - `GET /logs should filter by LogViewState.clearedAt`

3. **Write Database Schema Test (Red)**
   - **File**: `backend/src/logs/logs.service.spec.ts` (integration section)
   - **Test**: Prisma migration applied successfully
   - **Verify**: `LogViewState` table has `tenantId`, `clearedAt`

4. **Write Frontend Component Test (Red)**
   - **File**: `frontend/src/pages/Logs.spec.tsx`
   - **Tests to add**:
     - `should render Clear Logs button`
     - `should show confirmation dialog on click`
     - `should call POST /logs/clear-view on confirm`
     - `should refresh logs list after clear`

---

## Phase 2: Green – Implement Minimal Code

**Objective**: Write minimal code to make all Phase 1 tests pass.

**Duration**: 1.5 hours

### Tasks

1. **Create LogViewState Model & Migration**
   - Add to `backend/prisma/schema.prisma`:
     ```prisma
     model LogViewState {
       id        String   @id @default(cuid())
       tenantId  String
       clearedAt DateTime @default(now())
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt
       @@unique([tenantId])
     }
     ```
   - Run `npx prisma migrate dev --name add_log_view_state`
   - Update Prisma client

2. **Implement LogsService.clearView(tenantId: string)**
   - Use `upsert` to create/update LogViewState
   - Return `{ clearedAt, message: 'Logs cleared' }`

3. **Implement LogsService.listByTenant(tenantId) Filter**
   - Modify existing `list()` method to check `LogViewState.clearedAt`
   - Filter: `where: { tenantId, createdAt: { gt: logViewState?.clearedAt } }`

4. **Implement LogsController.clearView() Endpoint**
   - Add `@Post('clear-view')` method
   - Call `logsService.clearView(currentUser.tenantId)`
   - Return cleared state

5. **Implement Frontend \"Clear Logs\" Button**
   - Add button in `Logs.tsx`
   - Add confirmation dialog (confirm before clear)
   - Call `POST /logs/clear-view` on confirm
   - Refresh logs list via `useQuery` refetch

---

## Phase 3: Refactor – Improve Code Quality

**Objective**: Enhance error handling, logging, and security.

**Duration**: 1 hour

### Tasks

1. **Backend Service Refactor**
   - Extract filter logic to helper: `buildLogsFilter(tenantId)`
   - Add logging: `this.logger.debug('Clearing logs for tenant...')`
   - Add error handling: `try-catch` with custom exception

2. **Backend Controller Refactor**
   - Add `@ApiOperation({ summary: 'Clear view marker for logs' })`
   - Add `@ApiResponse({ status: 200, description: 'Logs cleared' })`
   - Add DTO: `ClearViewResponseDto`
   - Add validation: ensure `tenantId` from JWT

3. **Frontend Component Refactor**
   - Extract dialog to separate component: `ClearLogsDialog.tsx`
   - Add error toast on failure
   - Add loading state during API call
   - Memoize button handler

---

## Phase 4: Integration Tests – End-to-End

**Objective**: Verify full flow works across layers.

**Duration**: 45 minutes

### Tasks

1. **Create Integration Test**
   - **File**: `backend/tests/integration/logs-clear-view.e2e.spec.ts`
   - **Scenario**:
     - Create 10 logs (timestamps T-5min, T-4min, ..., T+5min)
     - Call `POST /logs/clear-view` at time T
     - Verify `GET /logs` returns only logs after T
     - Verify old logs still exist in DB

2. **Multi-Tenant Isolation Test**
   - Create logs for Tenant A and Tenant B
   - Clear logs for Tenant A
   - Verify Tenant B logs unaffected
   - Verify Tenant A logs hidden but not deleted

---

## Phase 5: Documentation & Cleanup

**Objective**: Update docs and prepare for merge.

**Duration**: 15 minutes

### Tasks

1. **Update API Documentation**
   - Add `POST /logs/clear-view` to README/OpenAPI

2. **Update Code Comments**
   - JSDoc for `clearView()`, `buildLogsFilter()`

3. **Self-Review Checklist**
   - All tests passing ✅
   - Multi-tenant isolation verified ✅
   - No hardcoded secrets ✅
   - Error messages clear ✅

---

## Summary Table

| Phase          | Duration     | Gate                           |
| -------------- | ------------ | ------------------------------ |
| 1: Red         | 1h           | All tests failing              |
| 2: Green       | 1.5h         | All tests passing              |
| 3: Refactor    | 1h           | Tests green, code quality high |
| 4: Integration | 45m          | E2E tests passing              |
| 5: Docs        | 15m          | Ready for merge                |
| **Total**      | **~4 hours** | **✅ Complete**                |

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
