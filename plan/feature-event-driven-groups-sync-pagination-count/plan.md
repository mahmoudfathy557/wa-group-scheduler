# Execution Plan: Event-driven group sync with isLatest + Groups pagination/count

**Status**: Ready for Execution  
**Target Duration**: 2-4 hours  
**Approval Gate**: Backend tests and frontend build pass

---

## Phase 1: Red – Define Failing Cases

**Objective**: Capture reliability expectations before implementation.

1. Identify expected behavior for `isLatest` wait, timeout fallback, and fetch retries
2. Define assertions for empty-fetch retry and timeout handling
3. Define UI assertions for total count and pagination boundaries

**Deliverable**: Test scenarios documented and/or failing tests prepared

---

## Phase 2: Green – Implement Minimal Backend Reliability

**Objective**: Make group fetch resilient using event-driven readiness.

1. Add `chats.set(isLatest=true)` wait helper in `WhatsAppService`
2. Add timeout wrapper for `groupFetchAllParticipating`
3. Add bounded retry + delay for empty results
4. Keep `listGroups(tenantId): Promise<GroupMetadata[]>` return contract

**Deliverable**: Stable backend implementation with same API contract

---

## Phase 3: Refactor – Logging & Config Hygiene

**Objective**: Improve maintainability without behavior regressions.

1. Add env parsing helper for retry/timeout values
2. Add structured attempt logs with duration and count
3. Keep helper methods private and side-effect bounded

**Deliverable**: Cleaner service internals, no contract changes

---

## Phase 4: Frontend – Pagination and Count

**Objective**: Improve Groups UX with clear group counts and paging controls.

1. Add total count display in Groups header
2. Add client-side page state and `pageSize`
3. Slice rows into paged view and show range (`start-end / total`)
4. Add Prev/Next controls with proper disabled states

**Deliverable**: Groups page with pagination + count

---

## Phase 5: Validation

**Objective**: Confirm correctness and non-regression.

1. Run backend tests
2. Run frontend build
3. Verify type checks and compile success

**Deliverable**: Green validation run, ready for review

---

## Summary Table

| Phase         | Tests                      | Duration  | Gate                            |
| ------------- | -------------------------- | --------- | ------------------------------- |
| 1: Red        | Define failing scenarios   | 20-30 min | Exit: scenarios clear           |
| 2: Green      | Implement backend behavior | 45-75 min | Exit: flow works with fallback  |
| 3: Refactor   | Improve helpers/logging    | 20-30 min | Exit: clean code, same behavior |
| 4: Frontend   | Add pagination/count UI    | 30-45 min | Exit: paginated UI stable       |
| 5: Validation | Run tests/build            | 15-30 min | Exit: all checks pass           |

**Total**: 2-4 hours
