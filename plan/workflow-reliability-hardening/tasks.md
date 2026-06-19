# Task Checklist: Schedule Workflow Reliability Hardening

**Status**: 🔄 In Progress  
**Total Tasks**: 12  
**Completion Target**: All tasks → ✅ Complete

---

## Legend

- ⏳ **Not Started**: Task queued, awaiting execution
- 🔄 **In Progress**: Currently being worked on
- ✅ **Complete**: Task done, validated
- ⚠️ **Blocked**: Waiting on another task or external input
- 📌 **Red**: Test written, currently failing
- 📗 **Green**: Code implemented, test passing
- 🔧 **Refactor**: Behavior preserved, code improved

---

## Phase 1: Red – Write Failing Tests

### 1.1 Write startup rehydrate test

**Status**: ⏳ Not Started  
**File**: [backend/src/schedules/schedules.service.spec.ts](backend/src/schedules/schedules.service.spec.ts)

**Checklist**:

- [ ] Add a failing test for `rehydrateRepeats()`
- [ ] Mock active schedules without repeat keys
- [ ] Assert repeat job registration is invoked
- [ ] Capture the failing output in execution-log.md

**Completion Criteria**: Test fails until startup recovery is wired and exercised.

---

### 1.2 Write stale pending recovery test

**Status**: ⏳ Not Started  
**File**: [backend/src/schedules/pending-reconcile.service.spec.ts](backend/src/schedules/pending-reconcile.service.spec.ts)

**Checklist**:

- [ ] Add a failing test for the bounded stale-pending scan
- [ ] Assert only logs older than the cutoff are selected
- [ ] Assert requeue behavior is idempotent enough for repeated cron runs
- [ ] Capture the failing output in execution-log.md

**Completion Criteria**: Test fails until the recovery behavior is covered.

---

### 1.3 Write run completeness repair test

**Status**: ⏳ Not Started  
**File**: [backend/src/schedules/run-completeness.service.spec.ts](backend/src/schedules/run-completeness.service.spec.ts)

**Checklist**:

- [ ] Add a failing test for missing run/group repair
- [ ] Assert repaired rows are created only for missing groups
- [ ] Assert already-complete runs are a no-op
- [ ] Capture the failing output in execution-log.md

**Completion Criteria**: Test fails until completeness repair is explicitly covered.

---

### 1.4 Write backlog stats test

**Status**: ⏳ Not Started  
**File**: [backend/src/logs/logs.service.spec.ts](backend/src/logs/logs.service.spec.ts)

**Checklist**:

- [ ] Add a failing test for `stalePending`, `longPending`, and `pendingAwaitingEnqueue`
- [ ] Assert the query contract stays stable
- [ ] Capture the failing output in execution-log.md

**Completion Criteria**: Test fails until stats coverage is added.

---

## Phase 2: Green – Implement Minimal Code

### 2.1 Implement startup rehydrate support

**Status**: ⏳ Not Started  
**File**: [backend/src/schedules/schedules.service.ts](backend/src/schedules/schedules.service.ts)

**Checklist**:

- [ ] Ensure startup path re-registers repeat jobs for active schedules
- [ ] Keep the logic idempotent
- [ ] Run the targeted test until green

**Completion Criteria**: Startup recovery test passes.

---

### 2.2 Tighten stale pending recovery

**Status**: ⏳ Not Started  
**File**: [backend/src/schedules/pending-reconcile.service.ts](backend/src/schedules/pending-reconcile.service.ts)

**Checklist**:

- [ ] Keep the scan window explicit and bounded
- [ ] Preserve unique job IDs per retry cycle
- [ ] Run the targeted test until green

**Completion Criteria**: Pending recovery test passes.

---

### 2.3 Keep run completeness repair idempotent

**Status**: ⏳ Not Started  
**File**: [backend/src/schedules/run-completeness.service.ts](backend/src/schedules/run-completeness.service.ts)

**Checklist**:

- [ ] Repair only missing rows
- [ ] Requeue repaired logs once
- [ ] Preserve tenant scope

**Completion Criteria**: Completeness test passes.

---

### 2.4 Confirm stats coverage

**Status**: ⏳ Not Started  
**File**: [backend/src/logs/logs.service.ts](backend/src/logs/logs.service.ts)

**Checklist**:

- [ ] Keep the recovery counters in the response
- [ ] Preserve the API shape
- [ ] Run the stats test until green

**Completion Criteria**: Stats test passes.

---

## Phase 3: Refactor

### 3.1 Extract recovery helpers if needed

**Status**: ⏳ Not Started  
**Files**: [backend/src/schedules/\*.ts](backend/src/schedules)

**Checklist**:

- [ ] Remove obvious duplication only
- [ ] Keep behavior unchanged
- [ ] Keep tests green

**Completion Criteria**: Cleaner code without behavior change.

---

### 3.2 Add recovery comments

**Status**: ⏳ Not Started  
**Files**: recovery services and schedule service

**Checklist**:

- [ ] Add concise comments where recovery behavior is easy to misread
- [ ] Reference the related tests where helpful

**Completion Criteria**: Comments are useful and minimal.

---

### 3.3 Run build and full tests

**Status**: ⏳ Not Started  
**Commands**: `npm run build`, `npm run test`

**Checklist**:

- [ ] Build backend
- [ ] Run full backend test suite
- [ ] Record results in execution-log.md

**Completion Criteria**: Build and tests pass.

---

## Phase 4: Integration Validation

### 4.1 Validate startup recovery

**Status**: ⏳ Not Started

**Checklist**:

- [ ] Restart backend
- [ ] Confirm repeat jobs are restored for active schedules

**Completion Criteria**: Startup recovery works consistently.

---

### 4.2 Validate stale pending recovery

**Status**: ⏳ Not Started

**Checklist**:

- [ ] Confirm stale logs are requeued after the cutoff
- [ ] Confirm repeated cron runs stay bounded

**Completion Criteria**: Pending recovery remains controlled.

---

### 4.3 Validate completeness repair

**Status**: ⏳ Not Started

**Checklist**:

- [ ] Simulate partial fan-out
- [ ] Confirm missing group logs are repaired

**Completion Criteria**: Missing entries are repaired exactly once.

---

### 4.4 Run full backend suite

**Status**: ⏳ Not Started  
**Commands**: `npm run test`, `npm run build`

**Checklist**:

- [ ] Run backend tests
- [ ] Run build
- [ ] Capture results in execution-log.md

**Completion Criteria**: Full suite passes.

---

## Phase 5: Documentation & Cleanup

### 5.1 Update workflow docs

**Status**: ⏳ Not Started  
**File**: [docs/SCHEDULING_WORKFLOW_FLOWCHART.md](docs/SCHEDULING_WORKFLOW_FLOWCHART.md)

**Checklist**:

- [ ] Refresh if recovery behavior changed
- [ ] Keep Mermaid valid

**Completion Criteria**: Diagram stays accurate.

---

### 5.2 Final execution log entry

**Status**: ⏳ Not Started  
**File**: [plan/workflow-reliability-hardening/execution-log.md](plan/workflow-reliability-hardening/execution-log.md)

**Checklist**:

- [ ] Add final summary
- [ ] Note validation results
- [ ] Mark ready for merge

**Completion Criteria**: Execution log finalized.

---

### 5.3 Close scenario instructions

**Status**: ⏳ Not Started  
**File**: [plan/workflow-reliability-hardening/scenario-instructions.md](plan/workflow-reliability-hardening/scenario-instructions.md)

**Checklist**:

- [ ] Mark all phases complete
- [ ] Add completion note

**Completion Criteria**: Scenario instructions reflect completion.
