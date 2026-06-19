# Task: Fix Schedule Messaging Failure with 3+ Groups

**Task ID**: BUG-MULTIGROUP-MSG  
**Created**: 2026-06-19  
**Type**: Bugfix  
**Status**: ⏳ **Pending Start**

---

## Objective

When a schedule is configured with 3 or more groups selected, only the first 3 groups receive messages. Remaining groups are left in a "pending" status indefinitely.

**Target Outcome**: All selected groups, regardless of count, receive messages and move to completed status.

---

## Current State Snapshot

| Component         | Version/State                                 | Notes                                       |
| ----------------- | --------------------------------------------- | ------------------------------------------- |
| Framework         | NestJS + Bull Queue                           | Message processing via BullMQ               |
| Schedules Service | `src/schedules/schedules.service.ts`          | Handles schedule creation & group iteration |
| Message Processor | `src/schedules/message-send.processor.ts`     | Job processor for individual messages       |
| Trigger Processor | `src/schedules/schedule-trigger.processor.ts` | Initiates schedule messages                 |
| WhatsApp Service  | `src/whatsapp/whatsapp.service.ts`            | Sends to groups/contacts                    |
| Database          | Prisma ORM + migrations                       | Schedule + Group relationship tracking      |

---

## Scope: What's Included & Excluded

### ✅ Included

- Identify root cause of group limit (hardcoded 3? queue config? processor logic?)
- Fix group iteration logic in schedules/message-send processor
- Validate fix with 5+ groups
- Unit & integration tests for multi-group scenarios
- Update execution-log as work progresses

### ❌ Excluded

- UI/UX improvements
- Performance optimization (separate task if needed)
- WebSocket real-time updates (if out of scope)

---

## Flow Mode

**Approval-Gated** (recommended for production bug)  
After each phase completes, review findings in execution-log.md and confirm proceed to next phase.

---

## Status Tracking

| Phase                                 | Status         | Owner | ETA |
| ------------------------------------- | -------------- | ----- | --- |
| **Phase 1**: Root Cause Analysis      | ⏳ Not Started | TBD   | TBD |
| **Phase 2**: Code Review & Hypothesis | ⏳ Not Started | TBD   | TBD |
| **Phase 3**: Implement Fix            | ⏳ Not Started | TBD   | TBD |
| **Phase 4**: Test & Validate          | ⏳ Not Started | TBD   | TBD |
| **Phase 5**: Documentation & Cleanup  | ⏳ Not Started | TBD   | TBD |

---

## User Preferences & Decisions Log

- **Testing Strategy**: Local NestJS dev + unit tests (no staging needed initially)
- **Rollback Plan**: Git revert if fix introduces new issues
- **Communication**: Update in execution-log.md per phase
- **Review Gate**: Confirm before proceeding Phase 2→3 and Phase 4→5

---

## Next Steps

1. Review **assessment.md** for detailed component breakdown
2. Review **plan.md** for phased approach
3. Review **tasks.md** for granular checklist
4. Start Phase 1 (Root Cause Analysis)
5. Log progress in **execution-log.md**
