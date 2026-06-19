# Task Checklist: WhatsApp Account Switch Edge Cases

**Status**: ⏳ Ready to Start  
**Total Tasks**: 23

---

## Legend

- ⏳ Not Started
- 🔄 In Progress
- ✅ Complete
- ⚠️ Blocked
- 📌 Red
- 📗 Green
- 🔧 Refactor

---

## Phase 1: Red

### 1.1 Add failing send-processor switch-window tests

Status: ⏳  
TDD: 📌  
File: backend/src/schedules/message-send.processor.spec.ts

- [ ] Add test: fails when tenant socket disconnects before send
- [ ] Add test: retries bounded when reconnect not ready
- [ ] Run targeted test and capture failing output

### 1.2 Add failing reconcile observability test

Status: ⏳  
TDD: 📌  
File: backend/src/schedules/pending-reconcile.service.spec.ts

- [ ] Simulate sendQueue.add failure for all stale rows
- [ ] Expect warning/error logging for root cause visibility
- [ ] Run targeted test and capture failing output

### 1.3 Add failing stale-trigger race test

Status: ⏳  
TDD: 📌  
File: backend/src/schedules/schedule-trigger.processor.spec.ts

- [ ] Simulate schedule paused/deleted after trigger enqueue
- [ ] Assert safe skip behavior with no sendQueue calls
- [ ] Run targeted test and capture failing output

### 1.4 Add failing group-sync edge test

Status: ⏳  
TDD: 📌  
File: backend/src/groups/groups.service.spec.ts

- [ ] Test account switch where old groups remain in DB
- [ ] Test new account groups upsert correctly
- [ ] Validate expected list result semantics

### 1.5 Add failing integration switch-flow test

Status: ⏳  
TDD: 📌  
File: backend/tests/integration/account-switch.e2e.spec.ts

- [ ] Cover pause/disconnect/connect/sync/remap/resume sequence
- [ ] Assert no crash and expected log state transitions

### 1.6 Add failing auto-pause-on-disconnect tests

Status: ⏳  
TDD: 📌  
Files: backend/src/whatsapp/whatsapp.service.spec.ts, backend/src/schedules/schedules.service.spec.ts

- [ ] Add test: disconnect event pauses all active schedules for tenant
- [ ] Add test: repeated disconnect events keep pause idempotent
- [ ] Run targeted tests and capture failing output

Phase 1 exit:

- [ ] All new tests fail as expected

---

## Phase 2: Green

### 2.1 Implement minimal send-processor safeguards

Status: ⏳  
TDD: 📗  
File: backend/src/schedules/message-send.processor.ts

- [ ] Implement minimal logic to satisfy 1.1
- [ ] Ensure retry path remains bounded
- [ ] Re-run related tests

### 2.2 Implement reconcile failure visibility

Status: ⏳  
TDD: 📗  
File: backend/src/schedules/pending-reconcile.service.ts

- [ ] Log enqueue errors in catch path with schedule/log context
- [ ] Keep behavior best-effort (no crash)
- [ ] Re-run related tests

### 2.3 Validate stale-trigger safe path

Status: ⏳  
TDD: 📗  
File: backend/src/schedules/schedule-trigger.processor.ts

- [ ] Ensure stale trigger path is safe and quiet-enough
- [ ] Re-run related tests

### 2.4 Implement/confirm group-sync behavior expectations

Status: ⏳  
TDD: 📗  
File: backend/src/groups/groups.service.ts

- [ ] Ensure test-defined behavior passes
- [ ] Re-run related tests

### 2.5 Run full backend tests

Status: ⏳  
TDD: 📗  
File: backend/src/\*\*

- [ ] Run full backend test suite
- [ ] Capture output snapshot

### 2.6 Implement auto-pause on disconnect

Status: ⏳  
TDD: 📗  
Files: backend/src/whatsapp/whatsapp.service.ts, backend/src/schedules/schedules.service.ts

- [ ] Implement disconnect-triggered pause for tenant active schedules
- [ ] Ensure idempotent behavior for repeated disconnects
- [ ] Re-run related tests

Phase 2 exit:

- [ ] All Phase 1 tests pass

---

## Phase 3: Refactor

### 3.1 Refactor retry/log helper clarity

Status: ⏳  
TDD: 🔧  
Files: schedules processors/services

- [ ] Extract tiny helper(s) only if it reduces duplication
- [ ] Keep public behavior unchanged

### 3.2 Improve comments for switch-window behavior

Status: ⏳  
TDD: 🔧  
Files: message-send and reconcile services

- [ ] Add short comments where intent is non-obvious
- [ ] Avoid noisy comments

### 3.3 Re-run impacted tests

Status: ⏳  
TDD: 🔧

- [ ] Targeted tests pass
- [ ] Full backend tests pass

Phase 3 exit:

- [ ] Refactor complete and tests still green

---

## Phase 4: Integration

### 4.1 Execute account-switch e2e path

Status: ⏳  
File: backend/tests/integration/account-switch.e2e.spec.ts

- [ ] Validate end-to-end switch sequence
- [ ] Validate schedules are auto-paused on disconnect
- [ ] Verify no stuck pending growth

### 4.2 Validate multi-tenant isolation during switch

Status: ⏳

- [ ] Ensure tenant A switch does not affect tenant B jobs/logs

### 4.3 Validate operator flow manually

Status: ⏳

- [ ] Confirm auto-pause happened after disconnect
- [ ] Disconnect old account
- [ ] Connect new account
- [ ] Sync groups
- [ ] Remap schedules
- [ ] Resume schedules

Phase 4 exit:

- [ ] Integration validation complete

---

## Phase 5: Docs

### 5.1 Update runbook docs

Status: ⏳  
Suggested file: docs/ANTI_BAN_PLAN.md

- [ ] Add safe account-switch operational steps
- [ ] Add expected warnings and when to ignore/escalate

### 5.2 Finalize execution log

Status: ⏳  
File: plan/bugfix-whatsapp-account-switch-edge-cases/execution-log.md

- [ ] Record final results, blockers, and decisions

### 5.3 Final sign-off

Status: ⏳

- [ ] All tests green
- [ ] No unresolved blockers
- [ ] Auto-pause-on-disconnect behavior verified
- [ ] Ready for merge
