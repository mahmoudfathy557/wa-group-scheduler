# Task: Make Logs Read-Only and Move Resend Action to Retry Center

**Task ID**: FEATURE-LOGS-READONLY-RESEND-CENTER  
**Created**: 2026-06-19  
**Type**: feature  
**Scope**: full-stack  
**Status**: ⏳ **Pending Start**

---

## Objective

Keep the main logs view read-only and move the "Send now" action into a dedicated retry/resend screen. The logs page should remain a history and diagnostics surface, while the new action center handles retries for pending and failed messages.

**Target Outcome**:

- `frontend/src/pages/Logs.tsx` shows logs only, with no resend button
- A separate retry center page lists actionable logs and exposes the resend action
- Existing resend endpoint is reused; no change to message delivery behavior
- Tenant-scoped access and filtering remain intact

---

## Current State Snapshot

| Component   | Version/State          | File Path                      | Notes                                                |
| ----------- | ---------------------- | ------------------------------ | ---------------------------------------------------- |
| Framework   | NestJS 10 + Bull Queue | `backend/`                     | Message processing via BullMQ                        |
| Database    | Prisma + PostgreSQL 16 | `backend/prisma/schema.prisma` | Multi-tenant via `tenantId`                          |
| Frontend    | React 18 + Vite        | `frontend/src/`                | Logs page currently mixes read-only data and actions |
| Auth        | JWT (12h expiry)       | `backend/src/auth/`            | Tenant-scoped                                        |
| Logs Module | Existing               | `backend/src/logs/`            | Clear-view and resend endpoints already exist        |

---

## Scope: What's Included & Excluded

### ✅ Included

- Remove the resend button from the main logs table
- Introduce a dedicated retry/resend page for actionable log entries
- Reuse the existing `POST /logs/:id/resend` endpoint
- Keep filters and read-only inspection on the logs page
- Add navigation from the logs page to the retry center
- Add or update frontend tests for both surfaces

### ❌ Excluded

- Changing resend delivery semantics
- Changing how logs are stored or queried in the backend
- Deleting logs from the database
- Adding new queue jobs or retry algorithms
- Changing tenant scoping rules

---

## TDD Flow Mode

- **Red → Green → Refactor → Repeat**: write failing tests first, then implement the smallest change, then clean up
- **Test Entry Points**: frontend page/component tests around logs and retry center; backend resend tests only if the current route behavior needs coverage
- **Approval Gates**: verify the logs page is read-only before adding polish to the retry center
- **Integration Points**: logs list, resend endpoint, navigation/routing, tenant-scoped group labels

---

## Key Files to Review First

- [frontend/src/pages/Logs.tsx](frontend/src/pages/Logs.tsx)
- [frontend/src/App.tsx](frontend/src/App.tsx)
- [frontend/src/main.tsx](frontend/src/main.tsx)
- [backend/src/logs/logs.controller.ts](backend/src/logs/logs.controller.ts)
- [backend/src/logs/logs.service.ts](backend/src/logs/logs.service.ts)
- [backend/src/logs/logs.service.spec.ts](backend/src/logs/logs.service.spec.ts)

---

## Current Test Status

| File                                       | Coverage        | Notes                                                     |
| ------------------------------------------ | --------------- | --------------------------------------------------------- |
| `frontend/src/pages/Logs.tsx`              | Unknown/none    | No page-level test file confirmed                         |
| `backend/src/logs/logs.service.spec.ts`    | Partial         | Existing logs coverage likely needs regression protection |
| `backend/src/logs/logs.controller.spec.ts` | Partial/unknown | Resend endpoint behavior may need a targeted check        |

---

## Decisions Log

| Decision                                 | Rationale                                          | Status      |
| ---------------------------------------- | -------------------------------------------------- | ----------- |
| Keep Logs page read-only                 | Matches user intent and reduces accidental actions | ✅ Proposed |
| Add a dedicated resend/retry center page | Separates diagnostics from operations              | ✅ Proposed |
| Reuse existing resend endpoint           | Avoids backend churn and duplicate behavior        | ✅ Proposed |
| Preserve tenant scoping in the new view  | Prevents cross-tenant access to actionable logs    | ✅ Required |
