# Execution Plan: WhatsApp Account Switch Edge Cases

**Status**: Ready for Execution  
**Target Duration**: 3-5 hours  
**Approval Gate**: End of each phase with test results logged

---

## Phase 1: Red - Write Failing Tests

**Objective**: Define desired behavior before implementation.

1. Add message-send edge tests for disconnected/connecting socket windows
   - File: backend/src/schedules/message-send.processor.spec.ts
2. Add pending-reconcile test that simulates queue add failures and expects visibility
   - File: backend/src/schedules/pending-reconcile.service.spec.ts
3. Add trigger race test for repeated stale jobs when schedule paused/deleted
   - File: backend/src/schedules/schedule-trigger.processor.spec.ts
4. Add group-sync edge tests for account switching behavior
   - File: backend/src/groups/groups.service.spec.ts (create if missing)
5. Add disconnect policy tests for auto-pausing tenant active schedules
   - Files: backend/src/whatsapp/whatsapp.service.spec.ts or backend/src/schedules/schedules.service.spec.ts
6. Add integration red test for account-switch sequence
   - File: backend/tests/integration/account-switch.e2e.spec.ts (create if needed)

**Deliverable**: All new tests fail for the right reason, documented in execution-log.

---

## Phase 2: Green - Implement Minimal Code

**Objective**: Make failing tests pass with smallest safe changes.

1. Implement minimal safeguards in send flow for disconnected state transitions
   - File: backend/src/schedules/message-send.processor.ts
2. Add explicit reconcile enqueue-failure logging
   - File: backend/src/schedules/pending-reconcile.service.ts
3. Ensure trigger stale-job path remains safe and non-disruptive
   - File: backend/src/schedules/schedule-trigger.processor.ts
4. Clarify group-sync behavior and return data assumptions
   - File: backend/src/groups/groups.service.ts
5. Implement auto-pause of tenant active schedules on disconnect (idempotent)
   - Files: backend/src/whatsapp/whatsapp.service.ts and backend/src/schedules/schedules.service.ts
6. Add minimal API/UX signaling if needed for account switch runbook
   - Files: backend/src/whatsapp/whatsapp.controller.ts, frontend flow files if needed

**Deliverable**: Phase 1 tests pass.

---

## Phase 3: Refactor - Improve Clarity and Reliability

**Objective**: Keep behavior stable while improving maintainability.

1. Extract tiny helpers for repeated retry/log formatting logic
2. Keep comments only where intent is non-obvious
3. Re-run impacted unit tests after each refactor step

**Deliverable**: Code cleaner, no behavior regression.

---

## Phase 4: Integration Validation

**Objective**: Confirm full flow under realistic account-switch sequence.

1. Pause schedules -> disconnect old account -> connect new account
2. Confirm disconnect auto-pauses active schedules for tenant
3. Trigger schedule and validate bounded failures/retries with paused state
4. Sync groups and remap schedule groups
5. Resume schedules and validate sent logs
6. Validate tenant isolation with a second tenant active

**Deliverable**: Integration checks pass, with execution evidence in log.

---

## Phase 5: Documentation and Cleanup

**Objective**: Capture operational guidance and close task.

1. Add runbook section for safe account switching
   - Suggested file: docs/README.md or docs/ANTI_BAN_PLAN.md
2. Update execution-log with final results and follow-ups
3. Mark scenario-instructions status complete

**Deliverable**: Ready for merge with documented operator flow.

---

## Summary Table

| Phase | Focus       | Exit Criteria                   |
| ----- | ----------- | ------------------------------- |
| 1     | Red         | New edge tests fail as expected |
| 2     | Green       | New edge tests pass             |
| 3     | Refactor    | Cleaner code, tests still green |
| 4     | Integration | Account-switch flow validated   |
| 5     | Docs        | Runbook + logs complete         |
