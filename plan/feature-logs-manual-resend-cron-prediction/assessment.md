# Assessment: Add Manual Message Resend from Logs View with Next Cron Prediction

**Created**: 2026-06-19  
**Scope**: full-stack

---

## 1. Current Component State

### Frontend: Logs Page (`frontend/src/pages/Logs.tsx`)

| Component | File       | Purpose                    | Current Features                         | Changes Needed                                       |
| --------- | ---------- | -------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Logs      | `Logs.tsx` | Display message logs table | Status badge, error reason, auto-refresh | Add "Next Retry" column, "Resend now" button per row |

**Current Columns**:

- Time (createdAt)
- Group (groupJid → groupName mapping)
- Status (pending/sent/failed badge)
- Details (errorReason or whatsappMessageId)

**New Columns**:

- Next Retry (only for pending/failed) — calculated from schedule's cron + nextRun time

**New UI Elements**:

- Row action button: "Resend now" (disabled for "sent" status)
- Loading state on button (isPending)
- Error toast if resend fails

### Backend: Logs Service & Controller

| Component      | File                                  | Purpose                     | Test Coverage            | Changes Needed                                                                      |
| -------------- | ------------------------------------- | --------------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| LogsService    | `backend/src/logs/logs.service.ts`    | Query logs, calculate stats | `.spec.ts` exists (~60%) | Add `getNextRetryTime(messageId)` method, `resendMessage(messageId, userId)` method |
| LogsController | `backend/src/logs/logs.controller.ts` | Expose logs API             | `.spec.ts` exists (~70%) | Add `POST /logs/:id/resend` endpoint with guards                                    |

**Existing Methods**:

- `getLogs(tenantId, status?)` — Query logs, optionally filter by status
- `clearLogsFromView(tenantId)` — Soft-delete logs (clear-view feature)

**New Methods Needed**:

- `getNextRetryTime(scheduleId: string)` → returns `Date | null` (next cron tick)
- `resendMessage(messageId: string, tenantId: string)` → enqueues job, returns job ID

### Backend: Schedules Service

| Component        | File                                         | Purpose          | Changes Needed                                |
| ---------------- | -------------------------------------------- | ---------------- | --------------------------------------------- |
| SchedulesService | `backend/src/schedules/schedules.service.ts` | Manage schedules | Expose cron expression + next run time lookup |

**Interaction**: Logs service needs to query schedule's `cron` field to calculate next retry time

### Backend: Message-Send Processor

| Component            | File                                              | Purpose                  | Changes Needed                                                |
| -------------------- | ------------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| MessageSendProcessor | `backend/src/schedules/message-send.processor.ts` | Handle message send jobs | Will reuse; no changes needed (resend enqueues same job type) |

### Database Schema

| Table     | File            | Current Fields                                                              | Impact                         | Changes Needed                                               |
| --------- | --------------- | --------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| messages  | `schema.prisma` | id, scheduleId, groupJid, status, errorReason, whatsappMessageId, createdAt | Add logs without schema change | None required; resend creates new message records? Or reuse? |
| schedules | `schema.prisma` | id, tenantId, name, groups[], cron, nextRun                                 | Needed for cron calculation    | Read-only; no schema change                                  |

**Design Decision**: Manual resend will create a **new message record** (same schedule, new attempt) rather than updating existing. This preserves audit trail and avoids overwriting original error reason.

---

## 2. Test Inventory

### Existing Unit Tests

| File                                       | Count    | Coverage | Gaps                                                 |
| ------------------------------------------ | -------- | -------- | ---------------------------------------------------- |
| `backend/src/logs/logs.service.spec.ts`    | ~8 tests | ~60%     | Missing: `getNextRetryTime()`, `resendMessage()`     |
| `backend/src/logs/logs.controller.spec.ts` | ~6 tests | ~70%     | Missing: `POST /logs/:id/resend` endpoint            |
| `frontend/src/pages/Logs.spec.tsx`         | 0 tests  | 0%       | Needs creation: column rendering, button interaction |

### Test Cases to Add (TDD Red Phase)

```markdown
**Backend Unit Tests**:

- [ ] LogsService.getNextRetryTime() returns correct Date for valid schedule cron
- [ ] LogsService.getNextRetryTime() returns null if message already sent
- [ ] LogsService.getNextRetryTime() calculates next tick (not current)
- [ ] LogsService.resendMessage() validates tenant ownership
- [ ] LogsService.resendMessage() enqueues message-send job
- [ ] LogsService.resendMessage() respects anti-ban delay
- [ ] LogsController POST /logs/:id/resend returns 200 + job ID
- [ ] LogsController POST /logs/:id/resend returns 404 if message not found
- [ ] LogsController POST /logs/:id/resend returns 403 if not message owner (tenant)
- [ ] LogsController POST /logs/:id/resend returns 400 if already sent

**Frontend Component Tests**:

- [ ] Logs renders "Next Retry" column for pending messages
- [ ] Logs renders null/empty for sent messages (no retry time)
- [ ] Logs renders "Resend now" button for pending/failed (disabled for sent)
- [ ] Button click triggers POST /logs/:id/resend
- [ ] Button shows loading state while pending
- [ ] Button disabled after successful resend
- [ ] Error toast shown on resend failure

**Integration Tests**:

- [ ] E2E: Schedule cron triggers → creates message (pending) → calculateNextRetry → button resends → new job queued
- [ ] E2E: Multi-tenant: User A cannot resend User B's messages
- [ ] E2E: Resend respects anti-ban delay (5–10s between groups)
- [ ] E2E: Socket.IO event emitted to correct tenant on resend
```

---

## 3. Breaking Changes & Risks

| Change                              | Risk Level | Mitigation                                          |
| ----------------------------------- | ---------- | --------------------------------------------------- |
| New API endpoint `/logs/:id/resend` | Low        | Versioned endpoint not needed; backwards compatible |
| Cron parsing library (cron-parser)  | Low        | Small, established package; add to package.json     |
| New message records on resend       | Low        | Maintains audit trail; no schema change             |
| Socket.IO event broadcast           | Low        | Use tenant context; no impact on existing events    |

---

## 4. Multi-Tenant Impact

- ✅ **Endpoint security**: `POST /logs/:id/resend` must verify `message.schedule.tenantId === currentUser.tenantId`
- ✅ **Cron lookup**: Ensure schedule query scoped to tenant
- ✅ **Job enqueue**: Message-send job payload includes tenant context (existing pattern)
- ✅ **Socket.IO broadcast**: Emit to tenant-specific room (e.g., `logs-updates:${tenantId}`)
- ✅ **Test scenario**: Two tenants, verify User A cannot resend User B's messages

---

## 5. Queue/Job Impact

| Job Type     | File                        | Impact                         | Changes Needed                |
| ------------ | --------------------------- | ------------------------------ | ----------------------------- |
| message-send | `message-send.processor.ts` | Will handle manual resend jobs | None; reuse existing job type |

**Job Payload**:

- Existing payload likely: `{ scheduleId, groups: [], tenantId }`
- Resend will enqueue same format but with single message's groupJid + schedule context

---

## 6. Cron Calculation Strategy

**Goal**: Show user "Next Retry: 2026-06-19 15:30" for pending/failed messages.

**Approach**:

1. Fetch schedule's `cron` expression (e.g., `"0 15 * * *"` = daily at 3 PM)
2. Fetch schedule's `nextRun` timestamp (when next job is scheduled)
3. Use `cron-parser` to calculate next tick from `cron` + current time
4. Return as ISO string to frontend
5. Frontend formats for display (localized time)

**Edge Cases**:

- Cron expression invalid → return null
- Schedule paused/deleted → return null
- Message already sent → return null
- Message created after next scheduled cron → calculate 1 tick ahead

---

## 7. Anti-Ban Delay Consideration

**Current behavior**: Message-send processor applies 5–10s jittered delay between group sends within a single job.

**Manual resend**: Should apply same delay. Resend endpoint will enqueue message-send job (no special handling needed).

---

## 8. Frontend Implementation Notes

**Data flow**:

1. Fetch logs (existing)
2. For each log with status !== "sent", call **new backend endpoint** to get `nextRetryTime`
3. Render column with formatted time
4. Button click → `POST /logs/:id/resend` → show loading → update UI on completion

**Alternative**: Fetch `nextRetryTime` in bulk (single endpoint returning array of `{ messageId, nextRetryTime }`). **Recommended for scalability.**

---

## 9. Recommended Approach & Phases

**TDD Strategy**: Red → Green → Refactor → Integration → Docs

1. **Phase 1 (Red)**: Write all failing tests (backend cron calc, resend endpoint, frontend column/button)
2. **Phase 2 (Green)**: Implement minimal code to pass tests
3. **Phase 3 (Refactor)**: Improve error handling, logging, security audit, Socket.IO integration
4. **Phase 4 (Integration)**: E2E flow + multi-tenant isolation + anti-ban delay verification
5. **Phase 5 (Docs)**: Update README, code comments, Swagger docs

**Estimated Effort**: ~4.25 hours

---

## 10. Technology Stack Details

| Technology       | Package                | Purpose                             | Notes                       |
| ---------------- | ---------------------- | ----------------------------------- | --------------------------- |
| Cron Parsing     | `cron-parser`          | Calculate next cron tick            | `npm install cron-parser`   |
| State Management | React Query (existing) | Manage logs query + resend mutation | Reuse `useMutation` pattern |
| Real-time        | Socket.IO (existing)   | Notify user on manual resend        | Emit to tenant room         |
| Testing          | Jest + Supertest       | Unit + integration tests            | Existing patterns           |
