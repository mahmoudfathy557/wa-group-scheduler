# Execution Plan: Add Manual Message Resend from Logs View with Next Cron Prediction

**Status**: Ready for Execution  
**Target Duration**: 4.25 hours  
**Approval Gate**: After each phase, verify test suite passes (`npm test`)

---

## Phase 1: Red – Write Failing Tests

**Objective**: Define expected behavior via tests; all tests fail initially.

**Duration**: 30 min

### Tasks

1. **Backend Unit Tests: Cron Calculation (Red Phase)**
   - **File**: `backend/src/logs/logs.service.spec.ts`
   - **Action**: Add failing tests for `getNextRetryTime(scheduleId)` method
     - Test 1: "should return next cron tick for valid schedule"
     - Test 2: "should return null if message already sent"
     - Test 3: "should calculate next tick correctly (not current time)"
   - **How to trigger Red**: Run `npm test -- logs.service.spec.ts`; expect failures
   - **Document**: List each failing test in execution-log.md

2. **Backend Unit Tests: Resend Endpoint Logic (Red Phase)**
   - **File**: `backend/src/logs/logs.service.spec.ts`
   - **Action**: Add failing tests for `resendMessage(messageId, tenantId)` method
     - Test 4: "should enqueue message-send job for pending message"
     - Test 5: "should reject resend if message already sent (status='sent')"
     - Test 6: "should reject resend if tenant doesn't own message (tenant mismatch)"
   - **Document**: Expected behavior for each test

3. **Backend Controller Tests: POST /logs/:id/resend (Red Phase)**
   - **File**: `backend/src/logs/logs.controller.spec.ts`
   - **Action**: Add failing tests for new endpoint
     - Test 7: "POST /logs/:id/resend should return 200 with job ID"
     - Test 8: "POST /logs/:id/resend should return 404 if message not found"
     - Test 9: "POST /logs/:id/resend should return 403 if not owner"
     - Test 10: "POST /logs/:id/resend should return 400 if already sent"
   - **Mock**: Mock logs service's `resendMessage()` method
   - **Document**: Expected response shape (e.g., `{ jobId, queuedAt }`)

4. **Frontend Component Tests: Logs Page (Red Phase)**
   - **File**: `frontend/src/pages/Logs.spec.tsx` (create if doesn't exist)
   - **Action**: Write failing tests for new column + button
     - Test 11: "should render 'Next Retry' column header"
     - Test 12: "should display formatted next retry time for pending message"
     - Test 13: "should show empty cell for sent message (no retry)"
     - Test 14: "should render 'Resend now' button for pending status"
     - Test 15: "should disable button for sent status"
     - Test 16: "button click should trigger POST /logs/:id/resend"
     - Test 17: "button should show loading state while pending"
   - **Mocks**: Mock API response for logs + cron data
   - **Document**: Component structure expectations

5. **Integration Test: E2E Manual Resend Flow (Red Phase)**
   - **File**: `backend/tests/integration/manual-resend.e2e.spec.ts` (create)
   - **Scenario**: Schedule cron triggers → message created (pending) → Logs.getNextRetryTime() returns correct time → User clicks "Resend now" → Job enqueued
   - **Mocks**: Baileys (mock WhatsApp responses), real PostgreSQL via test fixtures
   - **Assertions**:
     - Message record exists in DB
     - Next retry time calculated correctly
     - Manual resend creates new message record (or updates? design decision)
     - Job queued in BullMQ
   - **Document**: Flow diagram in execution-log.md

### Deliverable

- All Phase 1 tests written and failing (red indicator)
- Clear error messages ("method not implemented", "property undefined")
- Execution-log entry: List of failing tests with snapshot

---

## Phase 2: Green – Implement Minimal Code

**Objective**: Write minimal code to make all Phase 1 tests pass.

**Duration**: 1 hour

### Tasks

1. **Backend Service: Add `getNextRetryTime()` Method**
   - **File**: `backend/src/logs/logs.service.ts`
   - **Action**: Implement cron calculation
     ```typescript
     async getNextRetryTime(scheduleId: string): Promise<Date | null> {
       const schedule = await this.schedules.findUnique({ where: { id: scheduleId } });
       if (!schedule || !schedule.cron) return null;

       const parser = new CronParser(schedule.cron);
       return parser.next().toDate();
     }
     ```
   - **Rule**: Minimal implementation; error handling added in Refactor
   - **Run Tests**: `npm test -- logs.service.spec.ts` → expect passing

2. **Backend Service: Add `resendMessage()` Method**
   - **File**: `backend/src/logs/logs.service.ts`
   - **Action**: Implement message resend logic
     ```typescript
     async resendMessage(messageId: string, tenantId: string): Promise<{ jobId: string }> {
       const message = await this.messages.findUnique({ where: { id: messageId } });

       // Validate tenant + status
       if (!message || message.schedule.tenantId !== tenantId) throw new ForbiddenException();
       if (message.status === 'sent') throw new BadRequestException('Already sent');

       // Enqueue job
       const job = await this.messageQueue.add('send', {
         messageId: message.id,
         groupJid: message.groupJid,
         scheduleId: message.scheduleId,
         tenantId
       });

       return { jobId: job.id };
     }
     ```
   - **Run Tests**: `npm test -- logs.service.spec.ts` → expect all passing

3. **Backend Controller: Add `POST /logs/:id/resend` Endpoint**
   - **File**: `backend/src/logs/logs.controller.ts`
   - **Action**: Add endpoint method
     ```typescript
     @Post(':id/resend')
     @UseGuards(JwtAuthGuard)
     async resendMessage(
       @Param('id') messageId: string,
       @CurrentUser() user: any
     ): Promise<{ jobId: string }> {
       return this.logsService.resendMessage(messageId, user.tenantId);
     }
     ```
   - **Run Tests**: `npm test -- logs.controller.spec.ts` → expect passing

4. **Frontend: Add `getNextRetryTime()` Query Endpoint**
   - **File**: `frontend/src/lib/api.ts` (add utility)
   - **Action**: Create function to fetch next retry times
     ```typescript
     export async function getNextRetryTimes(
       messageIds: string[]
     ): Promise<Record<string, string | null>> {
       const { data } = await api.post("/logs/next-retry-times", {
         messageIds
       });
       return data; // { [messageId]: "2026-06-19T15:30:00Z" or null }
     }
     ```
   - **Note**: Backend needs to implement bulk endpoint (Phase 2 backend task)

5. **Backend: Add Bulk Next-Retry Endpoint**
   - **File**: `backend/src/logs/logs.controller.ts`
   - **Action**: Add `POST /logs/next-retry-times` endpoint for frontend
     ```typescript
     @Post('next-retry-times')
     @UseGuards(JwtAuthGuard)
     async getNextRetryTimes(
       @Body() body: { messageIds: string[] },
       @CurrentUser() user: any
     ): Promise<Record<string, string | null>> {
       return this.logsService.getNextRetryTimesForMessages(body.messageIds, user.tenantId);
     }
     ```
   - **Add method** to service to batch-calculate next retry times

6. **Frontend: Add Next Retry Column & Button to Logs.tsx**
   - **File**: `frontend/src/pages/Logs.tsx`
   - **Action**: Minimal implementation
     ```typescript
     // In render:
     // - Add <th>Next Retry</th> to table header
     // - Add <td>{nextRetryTimes[log.id] ? new Date(nextRetryTimes[log.id]).toLocaleString() : '—'}</td> to each row
     // - Add <button onClick={() => resendMutation.mutate(log.id)}>Resend</button> for non-sent messages
     ```
   - **Hooks**: Use `useQuery` to fetch next retry times on component mount
   - **Run Tests**: `npm test -- Logs.spec.tsx` → expect all passing

7. **Frontend: Add `resendMessage()` Mutation**
   - **File**: `frontend/src/pages/Logs.tsx`
   - **Action**: Use React Query's `useMutation` for POST resend
     ```typescript
     const resendMutation = useMutation({
       mutationFn: (messageId: string) => api.post(`/logs/${messageId}/resend`),
       onSuccess: () => {
         refetch(); // Refresh logs
       }
     });
     ```

8. **Database**: Verify Schema (No Migration Needed)
   - **File**: `backend/prisma/schema.prisma`
   - **Action**: Review to ensure Message + Schedule relations exist
   - **Run**: `npx prisma generate`

9. **Run Full Backend Test Suite**
   - **Command**: `npm test -- src/` (backend)
   - **Expected**: All Phase 1 tests passing (green)
   - **Document**: Test run snapshot

10. **Run Full Frontend Test Suite**
    - **Command**: `npm test -- frontend/src/`
    - **Expected**: All component tests passing
    - **Document**: Snapshot

### Deliverable

- Execution-log entry: "All Phase 1 tests passing (green)"
- Cron calculation working (tested)
- Resend endpoint accessible (tested)
- Frontend column + button rendering (tested)
- Commit hash for minimal implementation

---

## Phase 3: Refactor – Improve Code Quality & Security

**Objective**: Enhance code quality, error handling, security, and logging while keeping tests green.

**Duration**: 45 min

### Tasks

1. **Backend Service Refactor: Cron Calculation**
   - **File**: `backend/src/logs/logs.service.ts`
   - **Action**:
     - Add error handling: `try-catch` for invalid cron expression
     - Add logging: `this.logger.debug('Calculating next cron tick...')`
     - Add timezone handling (optional, for now use server timezone)
     - Add validation: reject past cron expressions
   - **Run Tests**: `npm test -- logs.service.spec.ts` → expect green

2. **Backend Service Refactor: Resend Logic**
   - **File**: `backend/src/logs/logs.service.ts`
   - **Action**:
     - Improve error messages (specific vs. generic)
     - Add audit logging: log who resent what message, when
     - Add anti-ban delay check: verify tenant's rate limiting (already handled by processor)
     - Add transaction wrapper (if needed for DB consistency)
   - **Run Tests**: → expect green

3. **Backend Controller Refactor: OpenAPI Docs**
   - **File**: `backend/src/logs/logs.controller.ts`
   - **Action**:
     - Add `@ApiOperation({ summary: 'Manually resend a message' })`
     - Add `@ApiParam({ name: 'id', description: 'Message ID' })`
     - Add `@ApiResponse({ status: 200, description: 'Job queued' })`
     - Add `@ApiResponse({ status: 403, description: 'Not message owner' })`
     - Add `@ApiBearerAuth()`
   - **Run Tests**: → expect green

4. **Frontend Refactor: Component Polish**
   - **File**: `frontend/src/pages/Logs.tsx`
   - **Action**:
     - Add error boundary for resend failures
     - Add toast notification on success/error
     - Memoize expensive computations (nextRetryTimes object)
     - Add accessibility: `aria-label` on button, semantic HTML
     - Format time consistently (use locale from user context)
   - **Run Tests**: → expect green

5. **Frontend Refactor: Hook Extraction**
   - **File**: `frontend/src/hooks/useNextRetryTimes.ts` (create)
   - **Action**: Extract cron/next-retry logic to custom hook
     ```typescript
     export function useNextRetryTimes(logs: Log[]) {
       const query = useQuery({
         queryKey: ["nextRetryTimes", logs.map((l) => l.id)],
         queryFn: () => getNextRetryTimes(logs.map((l) => l.id))
       });
       return query;
     }
     ```
   - **Use in Logs.tsx** instead of inline logic

6. **Security & Tenancy Audit**
   - **Service**: Verify `resendMessage()` checks tenant ownership ✅
   - **Controller**: Verify `@CurrentUser()` guard applied ✅
   - **Database**: Confirm queries properly scoped (Prisma $extends)
   - **API Response**: No sensitive data in error messages
   - **Test**: Multi-tenant scenario (User A cannot resend User B's messages)

7. **Run Full Test Suite**
   - **Command**: `npm test`
   - **Expected**: All tests green, no warnings
   - **Document**: Final snapshot

### Deliverable

- Execution-log entry: "Refactoring complete, all tests green"
- Security audit passed (tenant isolation verified)
- Code quality improved (error handling, logging)
- Commit hash(es) for refactoring

---

## Phase 4: Integration Tests – Validate End-to-End

**Objective**: Verify all layers work together (frontend → backend → queue → DB).

**Duration**: 1 hour

### Tasks

1. **E2E: Manual Resend Flow**
   - **Scenario**:
     1. Schedule created with cron "0 15 \* \* \*" (daily 3 PM)
     2. Trigger → message created (pending)
     3. Frontend fetches logs → calls /logs/next-retry-times
     4. Backend returns next cron tick (tomorrow 3 PM)
     5. Frontend displays "Next Retry: Tomorrow 3 PM"
     6. User clicks "Resend now"
     7. Frontend POSTs /logs/:id/resend
     8. Backend enqueues job, returns jobId
     9. Job starts processing (message sent or fails)
     10. Frontend receives Socket.IO update
   - **File**: `backend/tests/integration/manual-resend.e2e.spec.ts`
   - **Mocks**: Baileys (return mock WhatsApp response), real PostgreSQL
   - **Assertions**:
     - ✅ Next retry time calculated correctly
     - ✅ Manual resend creates new message record (or update?)
     - ✅ Job queued in Redis
     - ✅ Frontend receives feedback event
   - **Run Test**: `npm run test:e2e -- manual-resend.spec.ts` → expect **PASS**
   - **Document**: Test flow in execution-log.md

2. **Multi-Tenant Isolation Test**
   - **Scenario**:
     - Tenant A: Schedule with message (pending)
     - Tenant B: Same message ID (shouldn't exist)
     - User A attempts resend → success
     - User B attempts resend of User A's message → 403 Forbidden
   - **File**: `backend/tests/integration/multi-tenant-resend.spec.ts`
   - **Assertions**:
     - ✅ User A can resend their messages
     - ✅ User B cannot access User A's message
     - ✅ Next retry time only visible to message owner
   - **Run Test**: → expect **PASS**

3. **Anti-Ban Delay Verification**
   - **Scenario**: Resend 3-group message manually; verify 5–10s delay between sends
   - **Mocks**: Mock processor to capture job + timestamps
   - **Assertions**:
     - ✅ First group send starts at T+0
     - ✅ Second group send starts at T+5..10s
     - ✅ Third group send starts at T+10..20s
   - **Document**: Timing in execution-log.md

4. **Error Handling Test**
   - **Scenarios**:
     - Resend already-sent message → 400 Bad Request
     - Resend non-existent message → 404 Not Found
     - Tenant mismatch (User A resends User B's message) → 403 Forbidden
     - Invalid cron expression → next retry time = null (graceful)
   - **File**: `backend/tests/integration/error-cases-resend.spec.ts`
   - **Run Tests**: → expect all **PASS**

### Deliverable

- Execution-log entry: "Integration tests passing"
- E2E flow validated (schedule → manual resend → job queued)
- Multi-tenant isolation verified
- Error handling validated

---

## Phase 5: Documentation & Cleanup

**Objective**: Update docs and prepare for merge.

**Duration**: 15 min

### Tasks

1. **Update Code Comments**
   - **Files**: logs.service.ts, logs.controller.ts, Logs.tsx
   - **Action**:
     - Add JSDoc to `getNextRetryTime()`, `resendMessage()`, etc.
     - Explain cron parsing logic
     - Document API endpoint contract

2. **Update README** [if public API changed]
   - **File**: `docs/README.md`
   - **Add section**: "Manual Resend from Logs"
     - Endpoint: `POST /logs/:id/resend`
     - Description: "Manually trigger message resend without waiting for next cron tick"
     - Response: `{ jobId: string }`

3. **Update Swagger/OpenAPI** [if using Swagger]
   - Auto-generated from controller decorators
   - Verify: `/api-docs` shows new endpoint with correct schema

4. **Self-Review Checklist**
   - [ ] All tests passing (`npm test`)
   - [ ] No console errors or warnings
   - [ ] Tenant isolation verified
   - [ ] Error messages clear and actionable
   - [ ] Code follows project conventions
   - [ ] Security checklist passed:
     - [ ] No hardcoded secrets
     - [ ] Input validation (messageId, tenantId)
     - [ ] Tenant context verified
     - [ ] API guarded with JWT

5. **Git Commit & PR Summary**
   - **Commit message**: "feat: add manual message resend from logs with cron prediction"
   - **PR description**:

     ```
     ## What changed
     - Added "Next Retry" column to Logs table
     - Added "Resend now" button for pending/failed messages
     - New endpoint: POST /logs/:id/resend
     - Cron parsing to predict next scheduled tick

     ## How to test
     1. Create schedule with cron "0 15 * * *"
     2. Trigger → message created (pending)
     3. Go to Logs page → see "Next Retry: Tomorrow 3 PM"
     4. Click "Resend now" → message sent immediately
     5. Log entries created with "Manual resend" note

     ## Security
     - ✅ Tenant isolation verified (User A cannot resend User B's messages)
     - ✅ Anti-ban delay enforced
     - ✅ JWT guard on all new endpoints

     Fixes: [issue link if applicable]
     ```

### Deliverable

- Execution-log entry: "Ready for merge"
- All docs updated
- PR ready for review

---

## Summary Table

| Phase          | Focus                  | Tests              | Duration | Gate                               |
| -------------- | ---------------------- | ------------------ | -------- | ---------------------------------- |
| 1: Red         | Write failing tests    | Define behavior    | 30 min   | Exit: All tests failing (red)      |
| 2: Green       | Implement minimal code | Make passing       | 1 hour   | Exit: All Phase 1 tests passing    |
| 3: Refactor    | Improve code quality   | Keep passing       | 45 min   | Exit: Code quality ✅, tests green |
| 4: Integration | Full flow validation   | E2E + multi-tenant | 1 hour   | Exit: E2E tests passing            |
| 5: Docs        | Final polish           | None               | 15 min   | Exit: Ready for merge              |

**Total**: 4.25 hours

---

## Implementation Notes

### Cron Parsing

```typescript
import CronParser from "cron-parser";

function getNextRetryTime(cronExpression: string): Date {
  const parser = new CronParser(cronExpression, { currentDate: new Date() });
  return parser.next().toDate(); // Returns next scheduled time
}

// Example:
// cronExpression: "0 15 * * *" (daily at 3 PM)
// current time: 2026-06-19 14:00
// result: 2026-06-19 15:00 (today at 3 PM)

// if current time was 2026-06-19 16:00:
// result: 2026-06-20 15:00 (tomorrow at 3 PM)
```

### API Contract

**Endpoint**: `POST /logs/:id/resend`

**Request**:

```json
{
  // messageId in URL
}
```

**Response (200 OK)**:

```json
{
  "jobId": "abc-123-def",
  "queuedAt": "2026-06-19T14:30:00Z"
}
```

**Error Responses**:

- `400 Bad Request`: Message already sent
- `403 Forbidden`: Tenant doesn't own message
- `404 Not Found`: Message not found

### Frontend Integration

```typescript
// Logs.tsx

const { data: logs } = useQuery({
  queryKey: ["logs", status],
  queryFn: async () =>
    (await api.get("/logs", { params: status ? { status } : {} })).data
});

// Fetch next retry times for all logs
const { data: nextRetryTimes } = useQuery({
  queryKey: ["nextRetryTimes", logs?.map((l) => l.id)],
  queryFn: () =>
    api
      .post("/logs/next-retry-times", {
        messageIds: logs?.map((l) => l.id) || []
      })
      .then((r) => r.data),
  enabled: !!logs
});

// Resend mutation
const resendMutation = useMutation({
  mutationFn: (messageId: string) => api.post(`/logs/${messageId}/resend`),
  onSuccess: () => {
    refetch();
    // Optionally show toast: "Message resend queued"
  },
  onError: (error) => {
    // Show error toast
  }
});

// Render:
// <table>
//   <thead>
//     <tr>
//       <th>Next Retry</th>
//       <th>Action</th>
//   <tbody>
//     {logs.map(log => (
//       <tr>
//         <td>
//           {log.status !== 'sent' ? new Date(nextRetryTimes?.[log.id]).toLocaleString() : '—'}
//         </td>
//         <td>
//           {log.status !== 'sent' && (
//             <button
//               onClick={() => resendMutation.mutate(log.id)}
//               disabled={resendMutation.isPending}
//             >
//               {resendMutation.isPending ? 'Resending...' : 'Resend now'}
//             </button>
//           )}
//         </td>
```
