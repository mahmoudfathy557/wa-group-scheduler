# Assessment: Schedule Messaging 3+ Groups Bug

**Date**: 2026-06-19  
**Status**: Initial Assessment  
**Risk Level**: Medium (impacts core messaging feature)

---

## Current State Analysis

### Affected Components

| Component         | File                                          | Risk   | Notes                                                           |
| ----------------- | --------------------------------------------- | ------ | --------------------------------------------------------------- |
| Schedules Service | `src/schedules/schedules.service.ts`          | High   | Likely manages group list iteration                             |
| Message Processor | `src/schedules/message-send.processor.ts`     | High   | Processes individual group messages; may have queue/batch limit |
| Trigger Processor | `src/schedules/schedule-trigger.processor.ts` | Medium | Initiates schedule; may set initial group count                 |
| WhatsApp Service  | `src/whatsapp/whatsapp.service.ts`            | Medium | Sends to group; behavior on batch/array input                   |
| Database Schema   | `prisma/schema.prisma`                        | Low    | Schedule↔Group relationship; may inform expected behavior       |
| Unit Tests        | `src/schedules/schedules.service.spec.ts`     | High   | May lack multi-group test coverage                              |

---

## Problem Hypothesis

### Likely Root Causes (Ranked by Probability)

1. **Hardcoded Queue Batch Limit** (Probability: 60%)
   - Bull/BullMQ queue may have a default batch size of 3
   - Message processor iterates groups but only picks up first 3 jobs
   - Remaining jobs queued but not picked by processor

2. **Array Slice in Group Iteration** (Probability: 40%)
   - `schedules.service.ts` or `schedule-trigger.processor.ts` may `.slice(0, 3)` groups
   - Or explicit `groups.length > 3 ? groups.slice(0, 3) : groups`
   - Simple to miss in code review

3. **Promise.all or Queue Concurrency Limit** (Probability: 30%)
   - Message processor uses `Promise.all([...])` with hardcoded `.slice(0, 3)`
   - Or Bull queue configured with `{ attempts: 3 }` globally, blocking further jobs
   - Or concurrent worker count set to 3

4. **Database Query Limit** (Probability: 10%)
   - Prisma query in trigger processor: `.take(3)` or `.skip(0).take(3)` on group lookup

---

## Breaking Changes Assessment

✅ **Low Risk for Fixes**

- Bug fix should not introduce breaking changes
- API contract unchanged (still accepts 3+ groups)
- Database schema unchanged

---

## Compatibility Matrix

| Layer         | Current Behavior          | Target Behavior      | Breaking?      |
| ------------- | ------------------------- | -------------------- | -------------- |
| **API**       | Accepts 3+ groups         | Accepts 3+ groups    | ❌ No          |
| **Database**  | Stores 3+ group refs      | Stores 3+ group refs | ❌ No          |
| **Queue**     | Processes 3 jobs          | Processes all jobs   | ❌ No          |
| **WebSocket** | May emit 3 status updates | Emits all updates    | ✅ Enhancement |

---

## Recommended Phasing & Approach

### Phase Strategy: **Waterfall (Root Cause → Targeted Fix)**

1. **Phase 1: Root Cause Analysis**
   - Inspect `message-send.processor.ts` for explicit `.slice(0, 3)` or queue config
   - Check `schedule-trigger.processor.ts` for group iteration
   - Check Bull queue config in `schedules.module.ts`
   - Log findings in execution-log.md

2. **Phase 2: Code Review & Hypothesis Validation**
   - Review all suspicions against codebase
   - Create hypothesis document
   - Trace data flow: Schedule → Groups → MessageJobs → Processor
   - Confirm "pending" status meaning (DB enum?)

3. **Phase 3: Implement Fix**
   - Apply minimal fix to root cause
   - Add safeguards (no `.slice()`, ensure full group iteration)
   - Update queue config if needed

4. **Phase 4: Test & Validate**
   - Write/update unit test: schedule with 5 groups → all 5 should send
   - Local integration test: trigger schedule with 5 groups, observe all complete
   - Verify "pending" status no longer appears

5. **Phase 5: Documentation & Cleanup**
   - Add comment explaining why 3+ groups matter
   - Update test coverage doc
   - Close execution-log

---

## Files to Modify (Estimated)

- `backend/src/schedules/message-send.processor.ts` (70% confidence)
- `backend/src/schedules/schedule-trigger.processor.ts` (40% confidence)
- `backend/src/schedules/schedules.service.ts` (30% confidence)
- `backend/src/schedules/schedules.module.ts` (20% confidence, queue config)
- `backend/src/schedules/schedules.service.spec.ts` (100% - add tests)

---

## Dependencies & Blockers

| Item                                | Status       | Impact                       |
| ----------------------------------- | ------------ | ---------------------------- |
| Access to local dev environment     | ✅ Ready     | Can test locally             |
| Database access (Prisma migrations) | ✅ Ready     | Can inspect schema           |
| NestJS dev server                   | ✅ Ready     | Can debug with `npm run dev` |
| Bull queue documentation            | ✅ Available | Reference as needed          |

---

## Success Criteria

1. ✅ Root cause identified and documented
2. ✅ Fix implemented with no new errors
3. ✅ All 5+ groups receive messages
4. ✅ "Pending" status no longer stuck
5. ✅ Unit test added covering 5+ group scenario
6. ✅ Code review passed

---

## Effort Estimate

| Phase     | Effort      | Risk       |
| --------- | ----------- | ---------- |
| Phase 1   | 30 min      | Low        |
| Phase 2   | 20 min      | Low        |
| Phase 3   | 20 min      | Medium     |
| Phase 4   | 30 min      | Medium     |
| Phase 5   | 15 min      | Low        |
| **Total** | **2 hours** | **Medium** |
