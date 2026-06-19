# Task Checklist: Schedule Messaging 3+ Groups Bug Fix

**Status**: ⏳ Ready to Start  
**Total Tasks**: 16  
**Completion Target**: All tasks → ✅ Complete

---

## Legend

- ⏳ **Not Started**: Task queued, awaiting execution
- 🔄 **In Progress**: Currently being worked on
- ✅ **Complete**: Task done, validated
- ⚠️ **Blocked**: Waiting on another task or external input
- ❌ **Failed**: Task failed; see notes for issue

---

## Phase 1: Root Cause Analysis

### 1.1 Inspect message-send.processor.ts

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/schedules/message-send.processor.ts`

**Objective**: Find `.slice(0, 3)`, hardcoded `3`, or concurrency limits.

**Checklist**:

- [ ] Open file in editor
- [ ] Search for `.slice(`, `.take(`, `Math.min(`, and `3` (context matters)
- [ ] Check for `@Process()` decorator config (concurrency, attempts)
- [ ] Record suspicious lines in execution-log.md
- [ ] Rate confidence: High / Medium / Low

**Completion Criteria**: At least 2 lines noted and confidence rated

---

### 1.2 Inspect schedule-trigger.processor.ts

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/schedules/schedule-trigger.processor.ts`

**Objective**: Verify groups are fetched in full and passed to message processor.

**Checklist**:

- [ ] Open file; locate group fetch logic
- [ ] Verify `.take()` or `.skip().take()` on group query (should be absent or no limit)
- [ ] Check how groups are passed to message processor (array? loop?)
- [ ] Note any filtering or limiting logic
- [ ] Record findings in execution-log.md

**Completion Criteria**: Group flow documented, no explicit limit found (or limit location noted)

---

### 1.3 Inspect schedules.service.ts

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/schedules/schedules.service.ts`

**Objective**: Check schedules service for group iteration or count logic.

**Checklist**:

- [ ] Open file; search for `.slice(0, 3)` or `groups.length > 3`
- [ ] Review `createSchedule()` / `updateSchedule()` methods
- [ ] Check group validation logic (max count?)
- [ ] Note any explicit group limits
- [ ] Add findings to execution-log.md

**Completion Criteria**: Service logic reviewed, no artificial 3-group limit found (or noted if found)

---

### 1.4 Check Bull queue configuration

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/schedules/schedules.module.ts`

**Objective**: Find queue config with hardcoded concurrency, batch size, or attempts = 3.

**Checklist**:

- [ ] Open `schedules.module.ts`
- [ ] Locate `BullModule.registerQueue(...)` call(s)
- [ ] Check for `{ concurrency: 3 }`, `{ batchSize: 3 }`, `{ attempts: 3 }`
- [ ] Note any default config that could limit to 3 jobs
- [ ] Record in execution-log.md

**Completion Criteria**: Queue config documented, concurrency/limits noted

---

### 1.5 Document Phase 1 findings

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `plan/schedule-multigroup-fix/execution-log.md`

**Objective**: Summarize Phase 1 findings and identify root cause candidate(s).

**Checklist**:

- [ ] Add timestamp entry to execution-log.md
- [ ] List all suspicious lines found (file + line number)
- [ ] Rate confidence for each suspect
- [ ] Identify top 3 likely root causes
- [ ] Mark Phase 1 complete

**Completion Criteria**: execution-log.md updated; root cause candidates ranked

---

## Phase 2: Code Review & Hypothesis Validation

### 2.1 Trace message flow end-to-end

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Files**: Multiple (see notes)

**Objective**: Understand how a schedule's groups become queued messages.

**Checklist**:

- [ ] Start at schedule trigger: where does trigger event originate?
- [ ] Trace group fetch: which query, any `.take()` or `.limit()`?
- [ ] Trace message job enqueue: how many jobs created per schedule+group combo?
- [ ] Note queue processor: how many jobs does it consume per call?
- [ ] Write flow diagram in execution-log.md (text format OK)

**Completion Criteria**: End-to-end flow documented; no missing links

---

### 2.2 Understand "pending" status semantics

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Files**: `prisma/schema.prisma`, `backend/src/schedules/schedules.service.ts`

**Objective**: Confirm what "pending" means and why groups 4+ get stuck there.

**Checklist**:

- [ ] Find message status enum/options in Prisma schema
- [ ] Confirm "pending" is a valid status value
- [ ] Trace where status is set (initial, during processing, completed)
- [ ] Hypothesize: are groups 4+ queued but never processed? Or never queued?
- [ ] Add hypothesis to execution-log.md

**Completion Criteria**: "Pending" status semantics clear; hypothesis stated

---

### 2.3 Validate hypothesis against code

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Files**: All Phase 1 findings

**Objective**: Confirm root cause explanation fits observations.

**Checklist**:

- [ ] Re-read Phase 1 suspects; pick top candidate
- [ ] Trace logic: if this code runs, does it explain "3 groups work, 4+ pending"?
- [ ] Check if groups 4+ are queued but processor skips them, or never queued at all?
- [ ] Document prediction: "Fix will be: [remove .slice(0,3) / increase concurrency / etc]"
- [ ] Update execution-log.md with validated hypothesis

**Completion Criteria**: Root cause explanation confirmed; fix strategy predicted

---

### 2.4 Check for env/config overrides

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Files**: `.env`, `docker-compose.yml`, `schedules.module.ts`

**Objective**: Ensure no environment variable is overriding/limiting group count.

**Checklist**:

- [ ] Check `.env` for `MAX_GROUPS`, `BATCH_SIZE`, `QUEUE_*`
- [ ] Check `docker-compose.yml` for environment overrides
- [ ] Check module initialization for hardcoded limits
- [ ] Note any found; otherwise confirm no env-based limit

**Completion Criteria**: Environment checked; no hidden limits found (or noted)

---

### 2.5 Write validated hypothesis document

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `plan/schedule-multigroup-fix/execution-log.md`

**Objective**: Final Phase 2 summary before proceeding to fix.

**Checklist**:

- [ ] Write entry: "**VALIDATED HYPOTHESIS**"
- [ ] State root cause in 1 sentence: e.g., "`.slice(0, 3)` in message-send.processor.ts line 42"
- [ ] Explain why: e.g., "Limits message jobs to first 3 groups regardless of input"
- [ ] Predict fix: e.g., "Remove `.slice(0, 3)` and loop all groups"
- [ ] Confidence: High / Medium / Low
- [ ] Approval: Ready to proceed to Phase 3? (Y/N)

**Completion Criteria**: Hypothesis validated, Phase 2 approved, ready for code fix

---

## Phase 3: Implement Fix

### 3.1 Remove/adjust 3-group limit in primary file

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: (Based on hypothesis; likely `message-send.processor.ts`)

**Objective**: Apply surgical fix to enable 3+ group messaging.

**Checklist**:

- [ ] Identify exact line to modify (from Phase 2 hypothesis)
- [ ] Make change (remove `.slice(0, 3)`, increase concurrency, etc.)
- [ ] Verify line is still syntactically valid
- [ ] Do not commit yet; wait for build check

**Completion Criteria**: Code changed, no syntax errors

---

### 3.2 Adjust queue config if needed

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/schedules/schedules.module.ts` (if applicable)

**Objective**: Update Bull queue concurrency or batch size if hardcoded to 3.

**Checklist**:

- [ ] Check if Phase 3.1 fix is sufficient (e.g., `.slice()` removal)
- [ ] If queue config is the issue, update concurrency to reasonable value (e.g., 10, 50)
- [ ] Add comment: "Concurrency increased to support multi-group messaging"
- [ ] Do not commit yet

**Completion Criteria**: Config adjusted (or skipped if not needed); syntactically valid

---

### 3.3 Add safeguards and comments

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Files**: Modified files from 3.1 and 3.2

**Objective**: Add explanatory comments and reasonable upper limits.

**Checklist**:

- [ ] Add comment above fixed line: "Allow messaging to unlimited groups (no .slice() limit)"
- [ ] Reference: "See test: should process messages for 5 groups (bug BUG-MULTIGROUP-MSG)"
- [ ] If new concurrency value: add comment explaining choice (e.g., "10 concurrent = balance throughput vs. CPU")
- [ ] Ensure no unguarded infinite loops created

**Completion Criteria**: Comments added; code review-ready

---

### 3.4 Run linter and build validation

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Command**: `npm run lint:fix && npm run build`

**Objective**: Ensure no syntax or lint errors before testing.

**Checklist**:

- [ ] CD to `backend/` directory
- [ ] Run `npm run lint:fix` (auto-fix style issues)
- [ ] Run `npm run build` (compile TypeScript)
- [ ] Verify zero errors (warnings OK if pre-existing)
- [ ] Note any errors in execution-log.md

**Completion Criteria**: Build succeeds with no new errors

---

### 3.5 Commit changes

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Command**: `git add && git commit`

**Objective**: Commit fix with clear message.

**Checklist**:

- [ ] Stage changes: `git add backend/src/schedules/`
- [ ] Commit: `git commit -m "fix(schedules): allow messaging to 3+ groups"`
- [ ] Commit body: "Removed .slice(0, 3) limit from message-send.processor.ts. Now supports unlimited groups. Fixes BUG-MULTIGROUP-MSG."
- [ ] Verify commit on local history: `git log --oneline -1`

**Completion Criteria**: Commit created with clear message

---

## Phase 4: Test & Validate

### 4.1 Add unit test for 5+ groups

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/schedules/schedules.service.spec.ts`

**Objective**: Add test case verifying 5-group message processing.

**Checklist**:

- [ ] Open `schedules.service.spec.ts`
- [ ] Add test: `it('should process messages for 5 groups', async () => { ... })`
- [ ] Mock schedule with groups: [group1, group2, group3, group4, group5]
- [ ] Trigger schedule message processing
- [ ] Assert: all 5 groups processed (check queue jobs or processor calls)
- [ ] Assert: no `.slice()` or early exit
- [ ] Save test file

**Completion Criteria**: Test written and saved; ready to run

---

### 4.2 Run unit tests

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Command**: `npm run test`

**Objective**: Verify new test passes and no regressions introduced.

**Checklist**:

- [ ] CD to `backend/` directory
- [ ] Run `npm run test` (or `npm run test -- --testPathPattern=schedules`)
- [ ] Verify test output: all tests passing
- [ ] Check coverage: schedules module ≥80%
- [ ] Note any failures in execution-log.md

**Completion Criteria**: All tests passing, coverage acceptable

---

### 4.3 Manual local testing (optional but recommended)

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Steps**: Interactive local test

**Objective**: Manually verify 5+ group messaging in dev environment.

**Checklist**:

- [ ] Start backend: `npm run dev` in `/backend` directory
- [ ] Start frontend: `npm run dev` in `/frontend` directory
- [ ] Create test schedule with 5 groups via frontend UI
- [ ] Trigger schedule to send messages
- [ ] Observe backend logs: confirm all 5 groups enqueued and processed
- [ ] Check frontend: all 5 groups should show "completed" or similar (not "pending")
- [ ] Note results in execution-log.md

**Completion Criteria**: All 5 groups sent messages; no "pending" status remains

---

### 4.4 Verify no regressions (1–2 group schedules)

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Steps**: Quick sanity check

**Objective**: Ensure existing 1–2 group schedules still work.

**Checklist**:

- [ ] Create schedule with 1 group; trigger and confirm sent
- [ ] Create schedule with 2 groups; trigger and confirm both sent
- [ ] Note results in execution-log.md

**Completion Criteria**: 1 and 2-group schedules still work

---

### 4.5 WebSocket update verification (if applicable)

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Steps**: Frontend observation (optional)

**Objective**: Confirm frontend receives status updates for all 5 groups.

**Checklist**:

- [ ] Watch frontend console during 5-group schedule trigger
- [ ] Confirm 5 status update events received
- [ ] Verify no update stuck on "pending"
- [ ] Note in execution-log.md (optional)

**Completion Criteria**: All 5 groups emit status updates

---

### 4.6 Document Phase 4 completion

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `plan/schedule-multigroup-fix/execution-log.md`

**Objective**: Final Phase 4 summary.

**Checklist**:

- [ ] Add entry: "**PHASE 4 COMPLETE**"
- [ ] List test results: "Unit tests: ✅ All passing (including new 5-group test)"
- [ ] Manual test: "✅ 5-group schedule sent all 5 messages"
- [ ] Regressions: "✅ 1–2 group schedules still work"
- [ ] Ready for Phase 5? (Y/N)

**Completion Criteria**: Phase 4 signed off; Phase 5 approved

---

## Phase 5: Documentation & Cleanup

### 5.1 Update test coverage documentation

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: Test coverage doc (if one exists; otherwise optional)

**Objective**: Record that multi-group messaging is now tested.

**Checklist**:

- [ ] Locate test coverage doc (or skip if not tracked separately)
- [ ] Add note: "Multi-group messaging: ✅ Tested for 5+ groups in schedules.service.spec.ts"
- [ ] Reference new test case line number
- [ ] Save

**Completion Criteria**: Coverage doc updated (or skipped if not applicable)

---

### 5.2 Add code comment to primary fix

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: (Same as Phase 3.1, likely `message-send.processor.ts`)

**Objective**: Ensure code clarity for future maintainers.

**Checklist**:

- [ ] Add comment above fixed section: "// No artificial limit on group count; all groups are processed"
- [ ] Add reference: "// See test: should process messages for 5 groups (schedules.service.spec.ts, BUG-MULTIGROUP-MSG)"
- [ ] Verify comment is clear and helpful
- [ ] Stage change for commit (if not already committed)

**Completion Criteria**: Comment added and saved

---

### 5.3 Final execution-log entry

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `plan/schedule-multigroup-fix/execution-log.md`

**Objective**: Close the task with final summary.

**Checklist**:

- [ ] Add timestamp: `**2026-06-19 T15:30** - TASK COMPLETE`
- [ ] Root cause: "`.slice(0, 3)` in message-send.processor.ts line 42"
- [ ] Fix applied: "Removed `.slice()` limit; now processes all groups"
- [ ] Tested: "Unit test added; manual test with 5 groups ✅ passed"
- [ ] Status: "✅ Ready for merge"

**Completion Criteria**: execution-log.md finalized

---

### 5.4 Update scenario-instructions status table

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `plan/schedule-multigroup-fix/scenario-instructions.md`

**Objective**: Mark all phases complete in status table.

**Checklist**:

- [ ] Open scenario-instructions.md
- [ ] Update status table: Phase 1–5 all "✅ Complete"
- [ ] Add completion date in table
- [ ] Save

**Completion Criteria**: Status table reflects completion

---

### 5.5 Optional: PR summary (if pushing to GitHub)

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: GitHub PR description

**Objective**: Provide clear PR context for reviewers.

**Checklist**:

- [ ] Create PR from feature branch to main
- [ ] Title: "fix: allow messaging to 3+ groups"
- [ ] Description: Link to BUG-MULTIGROUP-MSG task folder
- [ ] Include: root cause, fix approach, test added
- [ ] Reference: "Closes BUG-MULTIGROUP-MSG"

**Completion Criteria**: PR created (or skipped if not using GitHub)

---

## Summary

| Phase       | Task Count   | Status         |
| ----------- | ------------ | -------------- |
| **Phase 1** | 5 tasks      | ⏳ Not Started |
| **Phase 2** | 5 tasks      | ⏳ Not Started |
| **Phase 3** | 5 tasks      | ⏳ Not Started |
| **Phase 4** | 6 tasks      | ⏳ Not Started |
| **Phase 5** | 5 tasks      | ⏳ Not Started |
| **TOTAL**   | **26 tasks** | ⏳ Not Started |

---

## Progress Tracking

Update status as you work:

- Change ⏳ → 🔄 when starting a task
- Change 🔄 → ✅ when completing a task
- Mark ⚠️ if blocked; note reason
- Mark ❌ if failed; log error and retry step

**Target**: All 26 tasks → ✅ Complete by end of session.
