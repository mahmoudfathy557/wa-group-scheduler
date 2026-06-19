# WA Anti-Ban Critical Hardening Plan

## Scope

Implement only the selected critical anti-ban safeguards:

- Presence simulation before send
- First-message jitter fix (remove index-0 bypass)
- Inter-schedule randomization
- Server-managed text auto-variation

Out of scope for this phase:

- Session/account rotation
- Multi-instance coordination enhancements
- User-authored spintax UI

Deployment assumption:

- Single backend instance (current model)

## Objectives

1. Reduce automation fingerprints in send timing and behavior.
2. Keep delivery reliability and existing retry/cap behavior intact.
3. Maintain moderate additional latency per message (roughly 3-8s typical).
4. Preserve backward compatibility for current schedule APIs where possible.

## Phase Plan

### 1. Baseline and Guardrails

- Lock in current behavior with targeted tests around:
  - Send queue jitter behavior
  - Trigger fan-out timing
  - WhatsApp send path and retries
  - Daily-cap enforcement
- Define anti-ban timing environment controls for:
  - Trigger offset window
  - Typing simulation duration bounds
  - Inter-message jitter bounds

### 2. Timing Hardening (Queue Pipeline)

- Remove first-message jitter bypass so every send is delayed with randomized jitter.
- Add per-trigger random start offset before fan-out begins.
- Keep per-tenant Redis lock behavior unchanged to preserve serialization guarantees.
- Ensure no regression in daily-cap checks and retry behavior.

### 3. Presence Simulation Before Dispatch

- Add safe presence helper methods in WhatsApp service:
  - Presence subscribe
  - Composing state
  - Paused state
  - Optional read action
- In message send worker, enforce sequence:
  1. Optional subscribe/read
  2. Composing
  3. Wait randomized typing duration
  4. Paused
  5. Send message
- Use fail-open policy: presence action failures should log and continue sending.

### 4. Server-Managed Auto-Variation

- Implement backend-only variation strategy (no user-authored template syntax required).
- Resolve final text per group job at trigger/fan-out stage.
- Keep deterministic fallback to original schedule message when variation is unavailable.

### 5. Persistence and Observability

- Extend message logs to store anti-ban telemetry:
  - Applied variation marker/fingerprint
  - Timing values actually used (jitter/typing)
  - Presence actions attempted and result status
- Add Prisma migration and wire telemetry writes from send processor.
- Add structured logs to diagnose delivery vs anti-ban behavior.

### 6. API/UI Alignment

- Keep create/update schedule contracts backward-compatible for this phase.
- Do not require frontend changes for core functionality.
- Optionally expose read-only anti-ban metadata later.

### 7. Validation and Rollout

- Add/adjust tests for:
  - First-message jitter now enabled
  - Trigger offset bounds
  - Variation fallback behavior
  - Presence fail-open behavior
- Rollout sequence:
  1. Apply DB migration
  2. Deploy backend changes
  3. Monitor delivery failures/retries/latency for 24h
  4. Tune timing windows if needed

## File-Level Implementation Targets

- backend/src/schedules/message-send.processor.ts
  - Apply jitter to all sends
  - Execute presence sequence before send
  - Write anti-ban telemetry to logs
- backend/src/schedules/schedule-trigger.processor.ts
  - Add inter-schedule randomized start offset
  - Resolve per-group auto-varied message text
- backend/src/whatsapp/whatsapp.service.ts
  - Add wrapped presence helper methods
- backend/prisma/schema.prisma
  - Add telemetry-related MessageLog fields
- backend/prisma/migrations/\*
  - Migration for new log fields
- backend/src/schedules/schedules.service.ts
  - Minimal wiring if send payload/contracts are adjusted
- backend/src/schedules/dto.ts
  - Only if optional anti-ban flags are introduced now

## Acceptance Criteria

1. First message in every fan-out is jittered (no index-0 bypass).
2. Trigger executions start with bounded random offsets.
3. Presence simulation runs before sends and does not block delivery on transient failures.
4. Daily cap and retry logic continue to behave as before.
5. Final sent message variant metadata and anti-ban timing telemetry are persisted.
6. Existing schedule create/update flows continue working without required new fields.

## Risks and Mitigations

- Risk: Presence API instability or throttling
  - Mitigation: Bounded retries/timeouts and fail-open behavior
- Risk: Excess latency harming throughput
  - Mitigation: Keep configurable windows and monitor after rollout
- Risk: Migration mismatch during deploy
  - Mitigation: Deploy schema migration before backend runtime changes
- Risk: Over-randomization causing unpredictability
  - Mitigation: Use bounded randomness and structured telemetry for tuning

## Success Metrics

- Lower clustered send timing patterns at schedule boundaries.
- Stable or improved send success rate with no increase in hard failures.
- No regression in daily-cap enforcement.
- Clear telemetry available for anti-ban behavior auditing.
