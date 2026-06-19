# Task Checklist: Make Logs Read-Only and Move Resend Action to Retry Center

**Status**: ⏳ Ready to Start  
**Total Tasks**: 11  
**Completion Target**: All tasks → ✅ Complete

---

## Legend

- ⏳ **Not Started**: Task queued, awaiting execution
- 🔄 **In Progress**: Currently being worked on
- ✅ **Complete**: Task done, tests verified
- ⚠️ **Blocked**: Waiting on another task or external input
- ❌ **Failed**: Task failed; see notes for issue
- 📌 **TDD Red**: Test written, failing
- 📗 **TDD Green**: Test passing, code implemented
- 🔧 **TDD Refactor**: Code quality improved

---

## Phase 1: Red – Write Failing Tests

### 1.1 Write failing test for read-only logs page

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/Logs.spec.tsx`  
**Depends On**: None

**Objective**: Prove the logs table no longer includes the resend action.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Create or update a page test for `Logs.tsx`
- [ ] Assert that filter controls and read-only columns still render
- [ ] Assert that "Send now" is not present on the logs page
- [ ] Assert that a retry-center link or CTA is present
- [ ] Run the test and confirm it fails before implementation
- [ ] Commit with message: `Test(red): logs page becomes read-only`

**Completion Criteria**: The test fails for the current implementation and clearly describes the missing split

---

### 1.2 Write failing test for retry center page

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/RetryCenter.spec.tsx`  
**Depends On**: 1.1

**Objective**: Define the dedicated resend surface.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Create test file for the new page
- [ ] Assert that pending/failed logs render
- [ ] Assert that resend action renders here
- [ ] Assert that clicking resend calls the existing API mutation
- [ ] Run the test and confirm it fails before implementation
- [ ] Commit with message: `Test(red): add retry center coverage`

**Completion Criteria**: Test documents the new retry center behavior

---

### 1.3 Write failing navigation test

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/App.spec.tsx` or router test file  
**Depends On**: 1.1

**Objective**: Ensure users can reach the retry center from the main app.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add route/navigation coverage
- [ ] Assert that the retry center is reachable from logs or main navigation
- [ ] Run the test and confirm it fails before implementation
- [ ] Commit with message: `Test(red): add retry center route coverage`

**Completion Criteria**: Navigation gap is explicit

---

### 1.4 Write backend resend regression test

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.controller.spec.ts`  
**Depends On**: None

**Objective**: Protect the existing resend endpoint while the UI changes.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add a focused test for `POST /logs/:id/resend`
- [ ] Assert tenant-scoped access still applies
- [ ] Run the test and confirm it passes or remains unchanged as expected
- [ ] Commit with message: `Test(red): protect resend endpoint regression`

**Completion Criteria**: Backend behavior remains stable while frontend changes

---

## Phase 2: Green – Implement Minimal Code

### 2.1 Remove resend action from Logs.tsx

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/Logs.tsx`  
**Depends On**: 1.1

**Objective**: Make the logs page read-only.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Remove resend mutation and button from the logs table
- [ ] Keep filters, refresh, and read-only metadata
- [ ] Add or keep a link to the retry center
- [ ] Run the page test until it passes
- [ ] Commit with message: `Feat: make logs page read-only`

**Completion Criteria**: Logs page no longer exposes action controls

---

### 2.2 Create retry center page

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/RetryCenter.tsx`  
**Depends On**: 1.2

**Objective**: Move resend interactions into a separate page.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Create the page shell
- [ ] Reuse the logs query shape for actionable items
- [ ] Add the resend mutation and action button here
- [ ] Surface loading and error states
- [ ] Run the page test until it passes
- [ ] Commit with message: `Feat: add retry center page`

**Completion Criteria**: Retry center page works and owns the resend action

---

### 2.3 Wire routing and navigation

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/App.tsx` or router config  
**Depends On**: 2.1, 2.2

**Objective**: Make the retry center reachable in the app.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add a route for the retry center
- [ ] Add a visible navigation link or CTA from logs
- [ ] Ensure the read-only logs page remains the primary history view
- [ ] Run the navigation test until it passes
- [ ] Commit with message: `Feat: wire retry center route`

**Completion Criteria**: Users can move between logs and retry center

---

### 2.4 Verify backend resend regression remains green

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.controller.spec.ts`  
**Depends On**: 1.4

**Objective**: Confirm no backend resend behavior changed.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Re-run the targeted resend endpoint tests
- [ ] Confirm no controller/service changes were needed
- [ ] Commit only if a small test fix or route guard adjustment was needed

**Completion Criteria**: Backend remains stable

---

### 2.5 Run focused frontend test suite

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: All affected frontend tests  
**Depends On**: 2.1, 2.2, 2.3

**Objective**: Make sure the split UX is passing before cleanup.

**Checklist**:

- [ ] Run the affected page and routing tests
- [ ] Resolve any failures with the smallest possible change
- [ ] Capture results in execution log

**Completion Criteria**: All target frontend tests pass

---

## Phase 3: Refactor – Improve Code Quality

### 3.1 Extract shared row or table rendering

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/components/` or nearby shared module  
**Depends On**: 2.1, 2.2

**Objective**: Reduce duplication only if both pages need the same row rendering.

**TDD Step**: 🔧 Refactor

**Checklist**:

- [ ] Evaluate whether the logs and retry center duplicate enough code to justify extraction
- [ ] If yes, extract a small shared row/table component
- [ ] Keep props explicit and simple
- [ ] Re-run tests and confirm no behavior change

**Completion Criteria**: Shared code is minimal and useful

---

### 3.2 Polish read-only logs UX

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/Logs.tsx`  
**Depends On**: 2.1

**Objective**: Make the logs history surface clearly read-only.

**TDD Step**: 🔧 Refactor

**Checklist**:

- [ ] Update labels so the page reads as history/diagnostics
- [ ] Ensure there is no stale resend copy in the layout
- [ ] Add a small hint pointing to the retry center if helpful
- [ ] Re-run the logs page test

**Completion Criteria**: Logs page communicates its new role clearly

---

### 3.3 Polish retry center UX

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/RetryCenter.tsx`  
**Depends On**: 2.2

**Objective**: Make the operator flow obvious and safe.

**TDD Step**: 🔧 Refactor

**Checklist**:

- [ ] Improve empty/error/loading states
- [ ] Make resend intent obvious in the UI
- [ ] Keep accessibility labels and table semantics intact
- [ ] Re-run the retry center test

**Completion Criteria**: Retry center is easy to use and understand

---

## Phase 4: Integration Tests – Validate End-to-End

### 4.1 Validate route flow end-to-end

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: Frontend integration or manual smoke path  
**Depends On**: 2.1, 2.2, 2.3

**Objective**: Confirm the user can move from logs to retry center and back.

**TDD Step**: 📗 Integration check

**Checklist**:

- [ ] Open logs page
- [ ] Navigate to retry center
- [ ] Trigger resend on a failed item
- [ ] Confirm refetch or state update behaves as expected

**Completion Criteria**: Navigation and resend flow work together

---

### 4.2 Validate tenant-scoped visibility

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: Backend or integration test coverage  
**Depends On**: 4.1

**Objective**: Ensure the split UI does not leak cross-tenant data.

**TDD Step**: 📗 Integration check

**Checklist**:

- [ ] Verify current tenant only sees its own actionable logs
- [ ] Verify resend still respects tenant context
- [ ] Record any gaps in execution log

**Completion Criteria**: No tenant leakage introduced

---

## Phase 5: Documentation & Cleanup

### 5.1 Update user-facing notes

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `docs/README.md` or relevant docs note  
**Depends On**: 4.1

**Objective**: Record the new division between history and action surfaces.

**Checklist**:

- [ ] Document that logs are read-only
- [ ] Document where resend actions live
- [ ] Ensure terminology matches the UI

**Completion Criteria**: Docs reflect the new UX split

---

### 5.2 Final self-review

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: Task artifacts  
**Depends On**: All prior tasks

**Objective**: Confirm the change is small, clear, and complete.

**Checklist**:

- [ ] No resend button remains on Logs.tsx
- [ ] Retry center owns resend actions
- [ ] Tests are green
- [ ] No extra abstraction was added without benefit

**Completion Criteria**: Ready for merge

---

## Summary

| Phase          | Task Count | Status | Duration     |
| -------------- | ---------- | ------ | ------------ |
| 1: Red         | 4          | ⏳     | 45 min       |
| 2: Green       | 5          | ⏳     | 1 hr         |
| 3: Refactor    | 3          | ⏳     | 45 min       |
| 4: Integration | 2          | ⏳     | 30 min       |
| 5: Docs        | 2          | ⏳     | 15 min       |
| **Total**      | **16**     | ⏳     | **~3 hours** |

---

## Task Dependencies

```
1.1 ──┐
      ├─→ 2.1 ──┐
1.2 ──┤         ├─→ 2.2 ──┐
      │         │         ├─→ 3.1, 3.2, 3.3 ──┐
1.3 ──┘         └─→ 2.3 ──┘                  ├─→ 4.1 ──┐
1.4 ──────────────────────────────────────────┘        │
                                                        ├─→ 4.2 ──┐
                                                        │         │
                                                        └─────────┤
                                                                  │
                                                                  └─→ 5.1 → 5.2 ✅
```
