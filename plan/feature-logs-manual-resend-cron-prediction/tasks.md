# Task Checklist: Add Manual Message Resend from Logs View with Next Cron Prediction

**Status**: ⏳ Ready to Start  
**Total Tasks**: 28  
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

## Phase 1: Red – Write Failing Tests (30 min)

### 1.1 Write Backend Service Tests: Cron Calculation

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.service.spec.ts`  
**Depends On**: None

**Objective**: Write failing tests for `getNextRetryTime(scheduleId)` method.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Open `backend/src/logs/logs.service.spec.ts`
- [ ] Add `describe('getNextRetryTime', () => { ... })`
- [ ] Add test 1: "should return next cron tick for valid schedule"
  - Mock schedule with cron: `"0 15 * * *"` (daily at 3 PM)
  - Mock current time: 2026-06-19 14:00
  - Assert: next tick is 2026-06-19 15:00
- [ ] Add test 2: "should return null if message already sent (status='sent')"
- [ ] Add test 3: "should calculate next tick (not current time) even if cron matches now"
- [ ] Run `npm test -- logs.service.spec.ts`; expect **FAIL** on all 3 tests
- [ ] Commit: "Test(red): Add failing cron calculation tests"

**Completion Criteria**: 3 failing tests with clear error messages ("method not implemented" or similar)

**Notes**:

- Reference existing patterns in `logs.service.spec.ts`
- Mock Prisma `schedules.findUnique()`
- Use `cron-parser` package (may need to install via npm)

---

### 1.2 Write Backend Service Tests: Resend Logic

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.service.spec.ts`  
**Depends On**: None

**Objective**: Write failing tests for `resendMessage(messageId, tenantId)` method.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add `describe('resendMessage', () => { ... })`
- [ ] Add test 4: "should enqueue message-send job for pending message"
  - Assert: job is queued with correct payload
  - Assert: returns `{ jobId: string }`
- [ ] Add test 5: "should reject resend if message already sent"
  - Mock message with `status: 'sent'`
  - Assert: throws `BadRequestException`
- [ ] Add test 6: "should reject resend if tenant doesn't own message (tenant mismatch)"
  - Mock message with `tenantId: 'tenant-other'`
  - Assert: throws `ForbiddenException`
- [ ] Run `npm test -- logs.service.spec.ts`; expect **FAIL**
- [ ] Commit: "Test(red): Add failing resend logic tests"

**Completion Criteria**: 3 more failing tests

---

### 1.3 Write Backend Controller Tests: POST Endpoint

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.controller.spec.ts`  
**Depends On**: 1.1, 1.2

**Objective**: Write failing tests for `POST /logs/:id/resend` endpoint.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add `describe('POST /logs/:id/resend', () => { ... })`
- [ ] Add test 7: "should return 200 with jobId for successful resend"
  - Mock service's `resendMessage()` to return `{ jobId: 'job-123' }`
  - Assert: response status 200
  - Assert: response body includes `jobId`
- [ ] Add test 8: "should return 404 if message not found"
  - Mock service's `resendMessage()` to throw `NotFoundException`
  - Assert: response status 404
- [ ] Add test 9: "should return 403 if not owner (tenant mismatch)"
  - Mock service's `resendMessage()` to throw `ForbiddenException`
  - Assert: response status 403
- [ ] Add test 10: "should return 400 if already sent"
  - Mock service's `resendMessage()` to throw `BadRequestException`
  - Assert: response status 400
- [ ] Run `npm test -- logs.controller.spec.ts`; expect **FAIL**
- [ ] Commit: "Test(red): Add failing controller endpoint tests"

**Completion Criteria**: 4 more failing tests

---

### 1.4 Write Backend Controller Tests: Bulk Next-Retry Endpoint

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.controller.spec.ts`  
**Depends On**: 1.1

**Objective**: Write failing tests for `POST /logs/next-retry-times` bulk endpoint.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add `describe('POST /logs/next-retry-times', () => { ... })`
- [ ] Add test 11: "should return next retry times for multiple messages"
  - Send: `{ messageIds: ['msg-1', 'msg-2'] }`
  - Assert: response is `{ 'msg-1': 'ISO-date-string', 'msg-2': null }`
- [ ] Add test 12: "should return null for sent messages (no retry)"
- [ ] Run `npm test -- logs.controller.spec.ts`; expect **FAIL**
- [ ] Commit: "Test(red): Add failing bulk next-retry endpoint tests"

**Completion Criteria**: 2 more failing tests

---

### 1.5 Write Frontend Component Tests: Next Retry Column

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/Logs.spec.tsx` (create if doesn't exist)  
**Depends On**: None

**Objective**: Write failing tests for new "Next Retry" column.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Create file `frontend/src/pages/Logs.spec.tsx` if not exists
- [ ] Add test 13: "should render 'Next Retry' column header"
  - Render Logs component
  - Assert: `screen.getByText('Next Retry')`
- [ ] Add test 14: "should display formatted next retry time for pending message"
  - Mock log with `status: 'pending'`
  - Mock next retry time data: `{ [logId]: '2026-06-19T15:00:00Z' }`
  - Assert: cell displays formatted time (e.g., "6/19/2026, 3:00 PM")
- [ ] Add test 15: "should show empty cell for sent message (no retry)"
  - Mock log with `status: 'sent'`
  - Assert: cell displays "—"
- [ ] Run `npm test -- Logs.spec.tsx`; expect **FAIL**
- [ ] Commit: "Test(red): Add failing column rendering tests"

**Completion Criteria**: 3 more failing tests

---

### 1.6 Write Frontend Component Tests: Resend Button

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/Logs.spec.tsx`  
**Depends On**: 1.5

**Objective**: Write failing tests for "Resend now" button.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Add test 16: "should render 'Resend now' button for pending/failed status"
  - Render Logs with pending message
  - Assert: button visible and enabled
- [ ] Add test 17: "should disable button for sent status"
  - Render with sent message
  - Assert: button disabled or not rendered
- [ ] Add test 18: "button click should trigger POST /logs/:id/resend"
  - Mock API `post(/logs/:id/resend)`
  - Click button
  - Assert: API called with correct URL
- [ ] Add test 19: "button should show loading state while pending"
  - Mock API to delay response
  - Click button
  - Assert: button text changes to "Resending..."
  - Assert: button disabled
- [ ] Run `npm test -- Logs.spec.tsx`; expect **FAIL**
- [ ] Commit: "Test(red): Add failing button interaction tests"

**Completion Criteria**: 4 more failing tests

---

### 1.7 Write Integration Test: E2E Manual Resend Flow

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/tests/integration/manual-resend.e2e.spec.ts` (create)  
**Depends On**: 1.1, 1.2, 1.3

**Objective**: Write failing E2E test for full manual resend flow.

**TDD Step**: 📌 Red

**Checklist**:

- [ ] Create file `backend/tests/integration/manual-resend.e2e.spec.ts`
- [ ] Write test 20: "should manually resend message from pending status"
  - Setup: Create schedule + trigger → message created (pending)
  - Mock Baileys to return success
  - Call `POST /logs/:id/resend`
  - Assert: response status 200
  - Assert: job queued in Redis
  - Assert: message status changes to 'sent' (or new record created)
- [ ] Run test; expect **FAIL**
- [ ] Commit: "Test(red): Add failing E2E manual resend test"

**Completion Criteria**: 1 more failing test

---

### Phase 1 Exit: Verify All Failing

- [ ] Run `npm test` across all files
- [ ] Confirm: 20+ tests failing (red)
- [ ] All error messages clear ("method not implemented", "property undefined")
- [ ] Execution-log updated with list of failing tests

**Deliverable**: Execution-log entry: "Phase 1 complete, [X] tests failing (red)"

---

## Phase 2: Green – Implement Minimal Code (1 hour)

### 2.1 Install Cron-Parser Package

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/package.json`  
**Depends On**: None

**Objective**: Add cron-parser dependency.

**Checklist**:

- [ ] Run `npm install cron-parser` in `backend/`
- [ ] Verify package added to `package.json`
- [ ] Run `npm test -- logs.service.spec.ts`; confirm cron-parser imports work

**Completion Criteria**: Package installed, importable

---

### 2.2 Implement `getNextRetryTime()` Service Method

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.service.ts`  
**Depends On**: 2.1

**Objective**: Add minimal cron calculation method.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Open `backend/src/logs/logs.service.ts`
- [ ] Add method:
  ```typescript
  async getNextRetryTime(scheduleId: string): Promise<Date | null> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule || !schedule.cron) return null;

    const parser = new CronParser(schedule.cron);
    return parser.next().toDate();
  }
  ```
- [ ] Import CronParser: `import CronParser from 'cron-parser';`
- [ ] Run `npm test -- logs.service.spec.ts` → expect tests 1–3 **PASS**
- [ ] Commit: "Feat: Implement getNextRetryTime method"

**Completion Criteria**: Tests 1–3 passing

---

### 2.3 Implement `resendMessage()` Service Method

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.service.ts`  
**Depends On**: 2.2

**Objective**: Add minimal resend logic.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add method:
  ```typescript
  async resendMessage(messageId: string, tenantId: string): Promise<{ jobId: string }> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { schedule: true }
    });

    if (!message) throw new NotFoundException('Message not found');
    if (message.schedule.tenantId !== tenantId) throw new ForbiddenException('Not owner');
    if (message.status === 'sent') throw new BadRequestException('Already sent');

    // Enqueue job
    const job = await this.messageQueue.add('send', {
      messageId: message.id,
      groupJid: message.groupJid,
      scheduleId: message.scheduleId,
      tenantId
    });

    return { jobId: job.id.toString() };
  }
  ```
- [ ] Inject message queue (BullMQ) if not already injected
- [ ] Run `npm test -- logs.service.spec.ts` → expect tests 4–6 **PASS**
- [ ] Commit: "Feat: Implement resendMessage method"

**Completion Criteria**: Tests 4–6 passing

---

### 2.4 Implement `POST /logs/:id/resend` Controller Endpoint

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.controller.ts`  
**Depends On**: 2.3

**Objective**: Add resend endpoint.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add method to controller:
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
- [ ] Ensure `@UseGuards(JwtAuthGuard)` applied (JWT validation)
- [ ] Run `npm test -- logs.controller.spec.ts` → expect tests 7–10 **PASS**
- [ ] Commit: "Feat: Add POST /logs/:id/resend endpoint"

**Completion Criteria**: Tests 7–10 passing

---

### 2.5 Implement `POST /logs/next-retry-times` Bulk Endpoint

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.controller.ts`  
**Depends On**: 2.2

**Objective**: Add bulk next-retry endpoint for frontend.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add to service (`logs.service.ts`):
  ```typescript
  async getNextRetryTimesForMessages(messageIds: string[], tenantId: string): Promise<Record<string, string | null>> {
    const messages = await this.prisma.message.findMany({
      where: {
        id: { in: messageIds },
        schedule: { tenantId }
      },
      include: { schedule: true }
    });

    const result: Record<string, string | null> = {};
    for (const msg of messages) {
      if (msg.status === 'sent') {
        result[msg.id] = null;
      } else {
        const nextTime = await this.getNextRetryTime(msg.scheduleId);
        result[msg.id] = nextTime?.toISOString() || null;
      }
    }
    return result;
  }
  ```
- [ ] Add to controller:
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
- [ ] Run `npm test -- logs.controller.spec.ts` → expect tests 11–12 **PASS**
- [ ] Commit: "Feat: Add POST /logs/next-retry-times bulk endpoint"

**Completion Criteria**: Tests 11–12 passing

---

### 2.6 Add Frontend API Utility Function

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/lib/api.ts`  
**Depends On**: 2.5

**Objective**: Add function to call bulk next-retry endpoint.

**Checklist**:

- [ ] Add function:
  ```typescript
  export async function getNextRetryTimes(
    messageIds: string[]
  ): Promise<Record<string, string | null>> {
    const { data } = await api.post("/logs/next-retry-times", { messageIds });
    return data;
  }
  ```
- [ ] Verify function is exported and importable

**Completion Criteria**: Function added, exported

---

### 2.7 Update Frontend Logs Component: Add Column & Button

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/Logs.tsx`  
**Depends On**: 2.6, 1.5, 1.6

**Objective**: Minimal UI update to add next-retry column and resend button.

**TDD Step**: 📗 Green

**Checklist**:

- [ ] Add `useQuery` to fetch next retry times:
  ```typescript
  const { data: nextRetryTimes = {} } = useQuery({
    queryKey: ["nextRetryTimes", data?.map((l) => l.id)],
    queryFn: () => getNextRetryTimes(data?.map((l) => l.id) || []),
    enabled: !!data
  });
  ```
- [ ] Add column header: `<th>Next Retry</th>`
- [ ] Add table cell in row loop:
  ```typescript
  <td>
    {l.status !== 'sent' ? new Date(nextRetryTimes[l.id]).toLocaleString() : '—'}
  </td>
  ```
- [ ] Add resend mutation:
  ```typescript
  const resendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/logs/${id}/resend`),
    onSuccess: () => refetch()
  });
  ```
- [ ] Add button cell:
  ```typescript
  <td>
    {l.status !== 'sent' && (
      <button
        onClick={() => resendMutation.mutate(l.id)}
        disabled={resendMutation.isPending}
      >
        {resendMutation.isPending ? 'Resending...' : 'Resend now'}
      </button>
    )}
  </td>
  ```
- [ ] Run `npm test -- Logs.spec.tsx` → expect tests 13–19 **PASS**
- [ ] Commit: "Feat: Add next-retry column and resend button to Logs page"

**Completion Criteria**: Tests 13–19 passing

---

### 2.8 Run Full Backend Test Suite

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: All  
**Depends On**: 2.1–2.7

**Objective**: Verify all Phase 1 tests passing.

**Checklist**:

- [ ] Run `npm test -- src/logs/`
- [ ] Verify: **All tests PASS** (expect ~12 tests)
- [ ] Run `npm test -- src/` (all backend)
- [ ] No new failures introduced
- [ ] Document snapshot in execution-log.md
- [ ] Commit: "Test: All Phase 2 backend tests passing"

**Completion Criteria**: Full backend test suite green

---

### 2.9 Run Full Frontend Test Suite

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/Logs.spec.tsx`  
**Depends On**: 2.7

**Objective**: Verify frontend tests passing.

**Checklist**:

- [ ] Run `npm test -- Logs.spec.tsx` (or full frontend suite)
- [ ] Verify: **All tests PASS** (~7 tests)
- [ ] No console warnings
- [ ] Commit: "Test: All Phase 2 frontend tests passing"

**Completion Criteria**: Frontend tests green

---

**Phase 2 Exit Criteria**: ✅ All Phase 1 tests passing, zero new failures

**Deliverable**: Execution-log entry: "Phase 2 complete, all tests green (20+ passing)"

---

## Phase 3: Refactor – Improve Code Quality (45 min)

### 3.1 Refactor Backend Service: Add Error Handling & Logging

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.service.ts`  
**Depends On**: 2.2, 2.3

**Objective**: Improve cron and resend methods with error handling.

**TDD Step**: 🔧 Refactor

**Checklist**:

- [ ] Update `getNextRetryTime()`:
  ```typescript
  async getNextRetryTime(scheduleId: string): Promise<Date | null> {
    try {
      const schedule = await this.prisma.schedule.findUnique({
        where: { id: scheduleId }
      });

      if (!schedule?.cron) {
        this.logger.warn(`Schedule ${scheduleId} has no cron expression`);
        return null;
      }

      const parser = new CronParser(schedule.cron);
      this.logger.debug(`Calculated next cron tick for schedule ${scheduleId}`);
      return parser.next().toDate();
    } catch (error) {
      this.logger.error(`Failed to calculate cron for schedule ${scheduleId}: ${error.message}`);
      return null; // Graceful fallback
    }
  }
  ```
- [ ] Add logging to `resendMessage()`:
  ```typescript
  this.logger.log(`User ${tenantId} manually resending message ${messageId}`);
  ```
- [ ] Add JSDoc comments to both methods
- [ ] Run `npm test -- logs.service.spec.ts` → expect all **PASS**
- [ ] Commit: "Refactor: Add error handling and logging to logs service"

**Completion Criteria**: Tests still green, improved code quality

---

### 3.2 Refactor Backend Controller: Add OpenAPI Documentation

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/src/logs/logs.controller.ts`  
**Depends On**: 2.4, 2.5

**Objective**: Add Swagger/OpenAPI decorators.

**TDD Step**: 🔧 Refactor

**Checklist**:

- [ ] Add to resend endpoint:
  ```typescript
  @Post(':id/resend')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Manually resend a message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Job queued', schema: { example: { jobId: 'abc-123' } } })
  @ApiResponse({ status: 403, description: 'Not message owner' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiBearerAuth()
  async resendMessage(...) { ... }
  ```
- [ ] Add to bulk endpoint similarly
- [ ] Run `npm test -- logs.controller.spec.ts` → expect all **PASS**
- [ ] Commit: "Refactor: Add OpenAPI documentation"

**Completion Criteria**: Tests green, Swagger docs generated

---

### 3.3 Security Audit: Tenant Isolation

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Files**: logs.service.ts, logs.controller.ts  
**Depends On**: 2.3, 2.4

**Objective**: Verify tenant isolation in new code.

**Checklist**:

- [ ] Service: Confirm `resendMessage()` checks `message.schedule.tenantId === tenantId`
  - ✅ Line: `if (message.schedule.tenantId !== tenantId) throw new ForbiddenException();`
- [ ] Service: Confirm `getNextRetryTimesForMessages()` filters by tenant:
  - ✅ Line: `where: { schedule: { tenantId } }`
- [ ] Controller: Confirm `@CurrentUser()` used to extract tenant ID
  - ✅ Line: `async resendMessage(@CurrentUser() user: any)`
- [ ] No hardcoded tenant IDs or bypasses
- [ ] Run multi-tenant test manually (see task 4.2 for details)
- [ ] Commit: "Security: Audit tenant isolation in resend flow"

**Completion Criteria**: Tenant isolation verified

---

### 3.4 Refactor Frontend Component: Improve UX

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/pages/Logs.tsx`  
**Depends On**: 2.7

**Objective**: Polish Logs component with error handling and accessibility.

**TDD Step**: 🔧 Refactor

**Checklist**:

- [ ] Add error toast on resend failure:
  ```typescript
  onError: (error) => {
    // Show error toast using toast library
    console.error("Resend failed:", error);
  };
  ```
- [ ] Add accessibility to button:
  ```typescript
  <button
    aria-label={`Resend message from ${groupNameByJid[l.groupJid]}`}
    ...
  />
  ```
- [ ] Format time consistently (use locale from user/browser):
  ```typescript
  new Date(nextRetryTimes[l.id]).toLocaleString("en-US", {
    dateStyle: "short",
    timeStyle: "short"
  });
  ```
- [ ] Memoize nextRetryTimes if large:
  ```typescript
  const nextRetryTimesMap = useMemo(
    () => nextRetryTimes || {},
    [nextRetryTimes]
  );
  ```
- [ ] Run `npm test -- Logs.spec.tsx` → expect all **PASS**
- [ ] Commit: "Refactor: Improve Logs component UX and accessibility"

**Completion Criteria**: Tests green, better UX

---

### 3.5 Extract Custom Hook for Next Retry Times

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `frontend/src/hooks/useNextRetryTimes.ts` (create)  
**Depends On**: 2.6

**Objective**: Extract reusable logic to custom hook.

**Checklist**:

- [ ] Create file `frontend/src/hooks/useNextRetryTimes.ts`
- [ ] Add hook:
  ```typescript
  export function useNextRetryTimes(logs: Log[] | undefined) {
    return useQuery({
      queryKey: ["nextRetryTimes", logs?.map((l) => l.id)],
      queryFn: () => getNextRetryTimes(logs?.map((l) => l.id) || []),
      enabled: !!logs
    });
  }
  ```
- [ ] Update `Logs.tsx` to use hook:
  ```typescript
  const { data: nextRetryTimes = {} } = useNextRetryTimes(data);
  ```
- [ ] Run `npm test -- Logs.spec.tsx` → expect all **PASS**
- [ ] Commit: "Refactor: Extract useNextRetryTimes custom hook"

**Completion Criteria**: Hook extracted, tests green

---

### 3.6 Run Full Test Suite

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: All  
**Depends On**: 3.1–3.5

**Objective**: Final Phase 3 test verification.

**Checklist**:

- [ ] Run `npm test` (backend + frontend combined)
- [ ] Expect: **All tests PASS**, no warnings
- [ ] Coverage: Ideally >= 80% for new code
- [ ] Document snapshot
- [ ] Commit: "Test: All Phase 3 refactoring complete"

**Completion Criteria**: All tests green, code quality improved

---

**Phase 3 Exit Criteria**: ✅ All tests passing, code refactored, security audit passed

**Deliverable**: Execution-log entry: "Phase 3 complete, all tests green, security ✅"

---

## Phase 4: Integration Tests – End-to-End (1 hour)

### 4.1 Run E2E Manual Resend Flow Test

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/tests/integration/manual-resend.e2e.spec.ts`  
**Depends On**: Phase 2 + 3 implementation complete

**Objective**: Verify full E2E flow works.

**Checklist**:

- [ ] Ensure test DB is clean or use test fixtures
- [ ] Run test: `npm run test:e2e -- manual-resend.e2e.spec.ts`
- [ ] Verify test 20 **PASSES**
- [ ] Assertions met:
  - ✅ Response status 200
  - ✅ Job queued in Redis
  - ✅ Message marked sent or new record created
- [ ] Document test flow in execution-log.md
- [ ] Commit: "Test(integration): E2E manual resend flow validated"

**Completion Criteria**: E2E test passing

---

### 4.2 Run Multi-Tenant Isolation Test

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/tests/integration/multi-tenant-resend.spec.ts` (create)  
**Depends On**: 4.1

**Objective**: Verify tenant data isolation.

**Checklist**:

- [ ] Create integration test file
- [ ] Write test: "Tenant A cannot resend Tenant B's messages"
  - Setup: Create message for Tenant A
  - Create JWT token for Tenant B
  - Attempt `POST /logs/:id/resend` with Tenant B's token
  - Assert: 403 Forbidden response
- [ ] Write test: "Tenant A can resend their own messages"
  - Assert: 200 OK response
- [ ] Run test: `npm run test:e2e -- multi-tenant-resend.spec.ts`
- [ ] Expect: **All PASS**
- [ ] Document: Multi-tenant isolation verified
- [ ] Commit: "Test(security): Verify multi-tenant isolation in resend"

**Completion Criteria**: Multi-tenant tests passing

---

### 4.3 Verify Anti-Ban Delay Enforcement

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/tests/integration/manual-resend.e2e.spec.ts` (extend)  
**Depends On**: 4.1

**Objective**: Verify anti-ban delay applies to manual resend.

**Checklist**:

- [ ] Extend test 20 or create new test 21:
  - Resend message with 3 groups manually
  - Mock message-send processor to log timestamps
  - Assert: 5–10s delay between each group send
- [ ] Run test
- [ ] Document timing in execution-log.md
- [ ] Commit: "Test(integration): Verify anti-ban delay on manual resend"

**Completion Criteria**: Anti-ban delay verified

---

### 4.4 Test Error Scenarios

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `backend/tests/integration/error-cases-resend.spec.ts` (create)  
**Depends On**: 4.1

**Objective**: Verify error handling in E2E context.

**Checklist**:

- [ ] Test 22: "Resend already-sent message returns 400"
- [ ] Test 23: "Resend non-existent message returns 404"
- [ ] Test 24: "Invalid cron expression handled gracefully (next-retry = null)"
- [ ] Run tests
- [ ] Expect: All **PASS**
- [ ] Commit: "Test(integration): Add error scenario tests"

**Completion Criteria**: Error handling validated

---

**Phase 4 Exit Criteria**: ✅ All integration tests passing, multi-tenant verified, anti-ban enforced

**Deliverable**: Execution-log entry: "Phase 4 complete, E2E + multi-tenant tests passing"

---

## Phase 5: Documentation & Cleanup (15 min)

### 5.1 Add Code Comments & JSDoc

**Status**: ⏳ Not Started  
**Owner**: TBD  
**Files**: logs.service.ts, logs.controller.ts, Logs.tsx  
**Depends On**: Phase 4

**Objective**: Document code for future maintainers.

**Checklist**:

- [ ] Add JSDoc to `getNextRetryTime()`:
  ```typescript
  /**
   * Calculate the next cron tick for a schedule.
   * @param scheduleId - Schedule ID
   * @returns Next scheduled time, or null if invalid/no cron
   */
  ```
- [ ] Add JSDoc to `resendMessage()` and other public methods
- [ ] Add inline comments for non-obvious logic (cron calculation, tenant check)
- [ ] Frontend: Add comments to Logs component explaining new column/button
- [ ] Commit: "Docs: Add code comments and JSDoc"

**Completion Criteria**: Code self-documenting

---

### 5.2 Update README

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: `docs/README.md`  
**Depends On**: Phase 4

**Objective**: Document new feature for users.

**Checklist**:

- [ ] Add section: "## Manual Message Resend from Logs"
- [ ] Document:
  - User can view "Next Retry" time for pending/failed messages
  - Click "Resend now" to immediately enqueue message send
  - Respects anti-ban delay (5–10s between groups)
  - Audit trail: resend logged with timestamp + user
- [ ] Add endpoint docs:
  - `POST /logs/:id/resend` - Manually resend message
  - `POST /logs/next-retry-times` - Bulk fetch next retry times
- [ ] Commit: "Docs: Update README with manual resend feature"

**Completion Criteria**: Feature documented

---

### 5.3 Final Self-Review Checklist

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: N/A  
**Depends On**: Phase 5.1, 5.2

**Objective**: Final quality gate before merge.

**Checklist**:

- [ ] **Tests**: Run `npm test` → all **PASS**, no failures
- [ ] **Code Quality**: No console.log, debug statements in production code
- [ ] **Security**:
  - [ ] Tenant isolation verified (multi-tenant tests pass)
  - [ ] No hardcoded secrets
  - [ ] Input validation on messageId, tenantId
  - [ ] JWT guard applied on all endpoints
  - [ ] Error messages don't leak sensitive data
- [ ] **Performance**:
  - [ ] No N+1 queries (use single `findMany` for bulk)
  - [ ] Cron calculation memoized if called repeatedly
- [ ] **Conventions**:
  - [ ] NestJS patterns followed (guards, decorators, exceptions)
  - [ ] React patterns followed (hooks, mutations, queries)
  - [ ] Project naming conventions used (camelCase, PascalCase)
- [ ] **Documentation**:
  - [ ] Code comments added
  - [ ] README updated
  - [ ] OpenAPI docs generated

**Completion Criteria**: All checks passed

---

### 5.4 Prepare PR & Commit

**Status**: ⏳ Not Started  
**Owner**: TBD  
**File**: Git  
**Depends On**: 5.3

**Objective**: Ready for code review.

**Checklist**:

- [ ] Squash/organize commits (optional):
  - `feat: add cron calculation for next retry time`
  - `feat: add manual resend endpoint and frontend button`
  - `refactor: improve error handling and logging`
  - `docs: update README and add JSDoc`
- [ ] Write PR description:

  ```markdown
  ## What changed

  - Added "Next Retry" column to Logs table showing next scheduled cron tick
  - Added "Resend now" button to manually send pending/failed messages
  - New API endpoints: POST /logs/:id/resend, POST /logs/next-retry-times
  - Uses cron-parser to predict next scheduled attempt

  ## How to test

  1. Create schedule with cron "0 15 \* \* \*" (daily 3 PM)
  2. Trigger → message created (pending)
  3. Go to Logs page → "Next Retry: Today 3:00 PM" (or Tomorrow if past 3 PM)
  4. Click "Resend now" → message sent immediately, status updated
  5. Manual resend logged in audit trail

  ## Security

  - ✅ Tenant isolation verified (User A cannot resend User B's messages)
  - ✅ Multi-tenant tests passing
  - ✅ Anti-ban delay enforced (5–10s between group sends)
  - ✅ JWT guard on all endpoints

  Closes: #[issue-number] (if applicable)
  ```

- [ ] Commit: `git push origin [branch-name]`

**Completion Criteria**: PR ready for review

---

**Phase 5 Exit Criteria**: ✅ Task complete, ready for merge

**Deliverable**: Execution-log entry: "Phase 5 complete, READY FOR PRODUCTION"

---

## Summary

| Phase          | Tasks        | Status | Duration       |
| -------------- | ------------ | ------ | -------------- |
| 1: Red         | 1.1–1.7      | ⏳     | 30 min         |
| 2: Green       | 2.1–2.9      | ⏳     | 1 hour         |
| 3: Refactor    | 3.1–3.6      | ⏳     | 45 min         |
| 4: Integration | 4.1–4.4      | ⏳     | 1 hour         |
| 5: Docs        | 5.1–5.4      | ⏳     | 15 min         |
| **Total**      | **28 tasks** | ⏳     | **4.25 hours** |

---

## Task Dependencies

```
Phase 1 (Red):
1.1 → 1.2 → 1.3 → 1.4 ↘
                        → 1.5 → 1.6 ↘
                                     → 1.7

Phase 2 (Green):
2.1 → 2.2 → 2.3 → 2.4 ↘
           2.5 → 2.6 ↘ → 2.7 → 2.8 → 2.9

Phase 3 (Refactor):
3.1, 3.2, 3.3 → 3.4, 3.5 → 3.6

Phase 4 (Integration):
4.1 → 4.2 → 4.3 → 4.4

Phase 5 (Docs):
5.1 → 5.2 → 5.3 → 5.4 ✅
```
