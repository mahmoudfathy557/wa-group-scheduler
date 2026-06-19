# Execution Plan: Make Logs Read-Only and Move Resend Action to Retry Center

**Status**: Ready for Execution  
**Target Duration**: 3 hours  
**Approval Gate**: After each phase, the targeted tests pass

---

## Phase 1: Red – Write Failing Tests

**Objective**: Define the read-only logs experience and the dedicated retry center via failing tests.

**Duration**: 45 minutes

### Tasks

1. **Logs Page Read-Only Tests (Red Phase)**
   - **File**: `frontend/src/pages/Logs.spec.tsx` or equivalent page test file
   - **Action**: Add tests that prove the logs view no longer renders the resend button in the table
   - **Checks**:
     - Logs page still renders status, next retry, details, and filters
     - No per-row "Send now" action in the logs table
     - Navigation or CTA to the retry center is present

2. **Retry Center Tests (Red Phase)**
   - **File**: `frontend/src/pages/RetryCenter.spec.tsx` or equivalent
   - **Action**: Add tests for a dedicated page that lists actionable logs only
   - **Checks**:
     - Pending/failed logs render with a resend action
     - Clicking resend triggers the existing mutation
     - Loading and error states are handled

3. **Navigation Tests (Red Phase)**
   - **File**: `frontend/src/App.spec.tsx` or router test file if present
   - **Action**: Add tests for route exposure or navigation entry
   - **Checks**:
     - Logs page links to retry center
     - Route is reachable from the main navigation if applicable

4. **Backend Regression Tests (Red Phase, only if needed)**
   - **File**: `backend/src/logs/logs.controller.spec.ts`
   - **Action**: Add a small test to ensure the resend endpoint still works as-is
   - **Checks**:
     - `POST /logs/:id/resend` remains available
     - Tenant-scoped authorization is unchanged

### Deliverable

- Execution-log entry with failing test names and expectations
- No implementation changes yet

---

## Phase 2: Green – Implement Minimal Code

**Objective**: Move the resend control out of Logs.tsx and into the dedicated page with the smallest safe change.

**Duration**: 1 hour

### Tasks

1. **Refactor Logs Page to Read-Only**
   - **File**: `frontend/src/pages/Logs.tsx`
   - **Action**: Remove the resend mutation and action column button
   - **Keep**:
     - status filter
     - refresh behavior
     - clear-from-view action if still desired on the history surface
   - **Add**: link/button to the retry center

2. **Create Retry Center Page**
   - **File**: `frontend/src/pages/RetryCenter.tsx`
   - **Action**: Reuse the existing logs query and resend mutation in a dedicated view
   - **Behavior**:
     - show pending/failed items
     - keep the resend button here
     - show contextual details for operators

3. **Wire Routing / Navigation**
   - **File**: `frontend/src/App.tsx` or router config
   - **Action**: Add the retry center route and navigation entry
   - **Behavior**: Logs page remains the default read-only destination

4. **Regression Test Fixes**
   - **File**: `frontend/src/pages/Logs.spec.tsx`, `frontend/src/pages/RetryCenter.spec.tsx`
   - **Action**: Update tests until the new split passes

### Deliverable

- Logs page is read-only
- Retry center owns resend action
- Targeted frontend tests pass

---

## Phase 3: Refactor – Improve Code Quality

**Objective**: Reduce duplication and tighten UX without changing behavior.

**Duration**: 45 minutes

### Tasks

1. **Extract Shared Log Table or Row UI**
   - **File**: `frontend/src/components/` or a nearby shared component
   - **Action**: Move common log row rendering into a reusable component if the two pages duplicate too much
   - **Rule**: Do this only if it reduces code without adding abstraction noise

2. **Polish UX States**
   - **File**: `frontend/src/pages/RetryCenter.tsx`
   - **Action**: Add clearer empty state and retry status messaging
   - **Action**: Make action labels consistent with the new location

3. **Accessibility and Semantics Review**
   - **File**: Modified frontend files
   - **Action**: Confirm buttons, headings, and table labels remain accessible

4. **Backend Regression Check**
   - **File**: `backend/src/logs/`
   - **Action**: Verify no backend change was accidentally introduced by the UI split

### Deliverable

- Clean, minimal split between read-only history and action center
- Tests still green

---

## Phase 4: Integration Tests – Validate End-to-End

**Objective**: Confirm the split works in the actual app flow.

**Duration**: 30 minutes

### Tasks

1. **Navigation Flow Check**
   - **Scenario**: open logs, jump to retry center, resend a failed item, return to logs
   - **Validation**: routing works and state refreshes correctly

2. **Resend Flow Check**
   - **Scenario**: pending/failed item in retry center → resend → item updates after refetch
   - **Validation**: existing resend endpoint still behaves correctly

3. **Tenant Context Check**
   - **Scenario**: current tenant only sees its own logs in both pages
   - **Validation**: no cross-tenant visibility leak introduced by the split

### Deliverable

- Execution log with successful navigation and resend flow notes

---

## Phase 5: Documentation & Cleanup

**Objective**: Capture the UX split and finish with a clean handoff.

**Duration**: 15 minutes

### Tasks

1. **Update UI Notes**
   - **File**: `docs/README.md` or a relevant frontend note if this flow is documented
   - **Action**: Describe that logs are read-only and operational retries live in the retry center

2. **Review Task Artifacts**
   - **Files**: all files in this task folder
   - **Action**: Confirm the execution log reflects the implemented flow

3. **Final Self-Review**
   - **Action**: Verify no action buttons remain on the logs page
   - **Action**: Verify the retry center is the only place with resend actions

### Deliverable

- Ready-for-merge status in execution log

---

## Summary Table

| Phase          | Tests         | Duration | Gate                             |
| -------------- | ------------- | -------- | -------------------------------- |
| 1: Red         | Write failing | 45 min   | Logs page no longer owns resend  |
| 2: Green       | Make passing  | 1 hr     | Split UX is implemented          |
| 3: Refactor    | Keep passing  | 45 min   | Duplication reduced, UX polished |
| 4: Integration | Full flow     | 30 min   | Navigation and resend verified   |
| 5: Docs        | Final polish  | 15 min   | Ready for merge                  |

**Total**: ~3 hours
