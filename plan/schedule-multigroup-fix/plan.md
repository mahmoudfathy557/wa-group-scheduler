# Execution Plan: Schedule Messaging 3+ Groups Bug Fix

**Status**: Ready for Execution  
**Target Duration**: 2–3 hours  
**Approval Gate**: Phase 2→3 and Phase 4→5

---

## Phase 1: Root Cause Analysis (30 min)

**Objective**: Locate the exact line(s) causing the 3-group limit.

### Tasks

1. **Inspect message-send.processor.ts**
   - Search for `.slice()`, `.take()`, hardcoded `3`, or `Math.min(..., 3)`
   - Check Bull job queue configuration (concurrency, attempts, priorities)
   - Note any explicit group filtering logic

2. **Inspect schedule-trigger.processor.ts**
   - Trace how groups are fetched from database
   - Look for group list truncation
   - Check if groups are passed as array to message processor

3. **Check schedules.service.ts**
   - Search for any group limit logic
   - Review group iteration in schedule creation/update
   - Confirm group count stored correctly in DB

4. **Check Bull queue configuration**
   - `schedules.module.ts`: BullModule registration
   - Look for default concurrency or batch size = 3
   - Check processor registration with explicit limits

5. **Document findings**
   - Record exact file + line where 3-group limit occurs
   - Copy suspicious code snippets to execution-log.md
   - Rate confidence: "found it" vs. "likely suspect"

### Deliverable

- Execution-log entry with root cause candidate(s) and confidence levels

---

## Phase 2: Code Review & Hypothesis Validation (20 min)

**Objective**: Confirm root cause and trace full data flow.

### Tasks

1. **Trace message flow end-to-end**
   - Start: Schedule trigger event → Groups fetched
   - Middle: Groups → Message jobs enqueued
   - End: Message processor → WhatsApp service
   - Note where groups could be limited

2. **Review "pending" status**
   - Find where message status is set to "pending"
   - Confirm DB enum/schema for message status
   - Understand why groups 4+ remain pending (queued but not processed?)

3. **Validate hypothesis against observations**
   - If `.slice(0, 3)` found: explain why it was added (safety? old limit?)
   - If queue config limit: verify concurrency or batch size
   - If processor skip: check if jobs are actually queued but skipped

4. **Check for environment/config overrides**
   - `.env` file: any `MAX_GROUPS`, `BATCH_SIZE`, `QUEUE_CONCURRENCY`?
   - Module registration: any hardcoded limits?
   - Docker compose: any environment variable limits?

5. **Write hypothesis document**
   - State the root cause clearly
   - Explain why it causes 3-group limit specifically
   - Predict the fix (remove `.slice()`, increase concurrency, etc.)

### Deliverable

- Execution-log entry with confirmed root cause and fix strategy

---

## Phase 3: Implement Fix (20 min)

**Objective**: Apply minimal, surgical fix to enable 3+ group messaging.

### Decisions Before Starting

- **Code Change Scope**: Minimal (one file or isolated change preferred)
- **Rollback Plan**: `git revert` if tests fail after fix
- **Review**: Self-review before moving to Phase 4

### Tasks

1. **Remove/adjust 3-group limit**
   - Delete `.slice(0, 3)` if found
   - Update concurrency/batch config if hardcoded to 3
   - Ensure full group list is iterated

2. **Add safeguard (if applicable)**
   - If removing `.slice()`: ensure no unbounded growth (still validate group count)
   - If changing queue config: ensure reasonable limits exist (no DoS risk)
   - Keep reasonable defaults (e.g., allow 100 groups, not unlimited)

3. **Update comments**
   - Add comment explaining why we removed the limit
   - Reference this bug ticket (BUG-MULTIGROUP-MSG)
   - Explain any new limits introduced

4. **Run local linter/formatter**
   - `npm run lint:fix` in backend folder
   - Ensure no syntax errors: `npm run build`

5. **Commit changes**
   - Use conventional commit: `fix(schedules): allow messaging to 3+ groups`
   - Reference issue in commit message

### Deliverable

- Code changes committed locally
- Execution-log entry: "Fix implemented, ready for testing"

### Files Modified

- Likely: `backend/src/schedules/message-send.processor.ts`
- Possibly: `backend/src/schedules/schedules.module.ts`

---

## Phase 4: Test & Validate (30 min)

**Objective**: Confirm fix works and doesn't introduce regressions.

### Tasks

1. **Add unit test for 5+ groups**
   - Edit `backend/src/schedules/schedules.service.spec.ts`
   - Add test case: "should process messages for 5 groups"
   - Mock group list with 5 items, verify all 5 are processed
   - Assertion: no `.slice()` or early exit

2. **Add integration test (if time permits)**
   - Create schedule with 5 groups
   - Trigger the schedule
   - Verify all 5 messages are queued
   - (May require test DB setup; optional if dev is manual)

3. **Manual local testing**
   - Start backend: `npm run dev` in `/backend`
   - Create test schedule with 5+ groups via frontend or API
   - Observe logs: all groups should be processed
   - Verify no "pending" messages stuck

4. **Run existing test suite**
   - `npm run test` in `/backend`
   - Confirm all tests pass (no regressions)
   - Check coverage: schedules module should be ≥80%

5. **Verify WebSocket updates (if applicable)**
   - Watch frontend/console for status updates
   - All 5 groups should emit status changes
   - No status stuck on "pending"

### Deliverable

- All tests passing
- Manual confirmation of 5-group messaging working
- Execution-log entry: "All tests passed, fix validated"

---

## Phase 5: Documentation & Cleanup (15 min)

**Objective**: Record learnings and close the task.

### Tasks

1. **Update test coverage document**
   - Add note: "Multi-group messaging now tested for 5+ groups"
   - Reference new test case in schedules.service.spec.ts

2. **Add comment to code**
   - In message-send.processor.ts or schedules.service.ts
   - Explain: "No artificial limit on group count; iteration handles any number"
   - Reference: "See test case: should process messages for 5 groups (schedules.service.spec.ts)"

3. **Final execution-log entry**
   - Date/time completed
   - Summary: "Root cause (X), fix applied, tested with 5 groups, all passing"
   - Any follow-up items

4. **Close scenario-instructions.md**
   - Update status table: all phases ✅ Complete
   - Add final sign-off line

5. **Optional: PR/commit summary**
   - If pushing to GitHub: write detailed PR description
   - Reference this task: BUG-MULTIGROUP-MSG
   - Link to this orchestration folder

### Deliverable

- Documented task completion
- Ready for merge/deployment

---

## Execution Order Rationale

**Waterfall → Quick Fix → Validate Approach** (not agile) because:

1. **Root Cause First**: Bug is specific; finding it quickly saves iteration
2. **Single Hypothesis**: Likely a simple `.slice(0, 3)` or queue config; not complex
3. **Minimal Fix**: Once found, fix is likely 1–3 lines; no design debate needed
4. **Test-Driven Validation**: New tests ensure we don't repeat the mistake
5. **No Rework Expected**: If root cause is correctly identified in Phase 1–2, Phase 3 fix is straightforward

### Risk Mitigation

| Risk                            | Mitigation                                                              |
| ------------------------------- | ----------------------------------------------------------------------- |
| Root cause not found in Phase 1 | Phase 2 includes fallback: check `.env`, module config, DB limits       |
| Fix breaks other tests          | Phase 4 runs full suite; Phase 3 includes `npm run build` validation    |
| Pendulum fix (overcorrect)      | Phase 2 validates hypothesis; Phase 4 tests with exact count (5 groups) |
| Regression in production        | This is a bugfix; existing 1–2 group schedules unaffected               |

---

## Success Metrics

✅ Schedule with 3 groups: still works (no regression)  
✅ Schedule with 5 groups: all 5 receive messages (bug fixed)  
✅ Schedule with 1 or 2 groups: still works (no regression)  
✅ All tests pass (no new failures)  
✅ Code is linted and builds without errors  
✅ Commit is clean and references bug ID

---

## Next Steps After Completion

1. Push to feature branch: `feature/fix-multigroup-messaging`
2. Create PR with link to this task folder
3. Request code review
4. Merge to main after approval
5. Deploy (staging first if org practice requires)
