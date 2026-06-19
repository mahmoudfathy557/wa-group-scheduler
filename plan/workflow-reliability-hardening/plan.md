# Execution Plan: Schedule Workflow Reliability Hardening

**Status**: Ready for Execution  
**Target Duration**: 2-4 hours  
**Approval Gate**: Review after Phase 1 and Phase 3

---

## Phase 1: Red – Write Failing Tests

**Objective**: Define the remaining reliability gaps with failing tests first.

### Tasks

1. **Write startup rehydrate test**
   - File: [backend/src/schedules/schedules.service.spec.ts](backend/src/schedules/schedules.service.spec.ts)
   - Add a failing test that expects active schedules to regain repeat jobs after startup.

2. **Write stale pending recovery test**
   - File: [backend/src/schedules/pending-reconcile.service.spec.ts](backend/src/schedules/pending-reconcile.service.spec.ts)
   - Add a failing test that proves the stale-pending loop stays bounded and idempotent.

3. **Write run completeness repair test**
   - File: [backend/src/schedules/run-completeness.service.spec.ts](backend/src/schedules/run-completeness.service.spec.ts)
   - Add a failing test that proves missing run/group rows are repaired exactly once.

4. **Write stats coverage test**
   - File: [backend/src/logs/logs.service.spec.ts](backend/src/logs/logs.service.spec.ts)
   - Add a failing test that asserts the recovery health counters are returned.

### Deliverable

- Execution-log entry with all red tests listed.

---

## Phase 2: Green – Implement Minimal Code

**Objective**: Make the failing tests pass with the smallest safe changes.

### Tasks

1. **Implement startup rehydrate support**
   - File: [backend/src/schedules/schedules.service.ts](backend/src/schedules/schedules.service.ts)
   - Ensure active schedules get repeat jobs restored after bootstrap.

2. **Tighten stale pending recovery**
   - File: [backend/src/schedules/pending-reconcile.service.ts](backend/src/schedules/pending-reconcile.service.ts)
   - Keep the scan bounded and avoid enqueue amplification.

3. **Keep run completeness repair idempotent**
   - File: [backend/src/schedules/run-completeness.service.ts](backend/src/schedules/run-completeness.service.ts)
   - Recreate only missing pending rows and queue them once.

4. **Confirm stats still report health**
   - File: [backend/src/logs/logs.service.ts](backend/src/logs/logs.service.ts)
   - Keep the backlog counters stable and accurate.

### Deliverable

- Execution-log entry with the green test results.

---

## Phase 3: Refactor – Improve Safety & Clarity

**Objective**: Clean up the reliability code without changing behavior.

### Tasks

1. **Extract helpers if duplicated**
   - Files: [backend/src/schedules/\*.ts](backend/src/schedules)
   - Pull repeated job payload or retry code into small helpers if it improves clarity.

2. **Add comments for recovery intent**
   - Files: recovery services and schedule service
   - Explain why startup restore and stale-pending repair must remain idempotent.

3. **Run build and tests**
   - Commands: `npm run build`, `npm run test`
   - Ensure no regressions were introduced.

### Deliverable

- Execution-log entry confirming the refactor is behavior-preserving.

---

## Phase 4: Integration Validation

**Objective**: Validate the recovery workflow end to end.

### Tasks

1. **Validate startup recovery**
   - Restart backend and confirm repeat jobs are restored for active schedules.

2. **Validate stale pending recovery**
   - Confirm stale pending logs are requeued without runaway duplication.

3. **Validate completeness repair**
   - Simulate partial fan-out and confirm missing group logs are repaired.

4. **Run full backend suite**
   - Commands: `npm run test`, `npm run build`

### Deliverable

- Execution-log entry with integration results.

---

## Phase 5: Documentation & Cleanup

**Objective**: Close out the task and align docs.

### Tasks

1. **Update workflow docs**
   - File: [docs/SCHEDULING_WORKFLOW_FLOWCHART.md](docs/SCHEDULING_WORKFLOW_FLOWCHART.md)
   - Refresh if recovery behavior or startup behavior changed.

2. **Finalize execution log**
   - File: [plan/workflow-reliability-hardening/execution-log.md](plan/workflow-reliability-hardening/execution-log.md)
   - Summarize the reliability fixes and validation.

3. **Close the scenario file**
   - File: [plan/workflow-reliability-hardening/scenario-instructions.md](plan/workflow-reliability-hardening/scenario-instructions.md)
   - Mark all phases complete.

### Deliverable

- Task marked ready for merge.
