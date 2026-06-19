# Task: Add Clear Logs from View Action

**Task ID**: FEATURE-LOGS-CLEAR-VIEW  
**Created**: 2026-06-19  
**Type**: feature  
**Scope**: full-stack  
**Status**: ⏳ **Pending Start**

---

## Objective

Add a new UI button on the logs page that clears currently visible logs from the page without deleting existing `MessageLog` rows.

**Target Outcome**: User can click a clear action and no previously seen logs appear on the logs page, while all raw log rows remain intact in PostgreSQL.

---

## Current State Snapshot

| Component          | Version/State                 | File Path                                                          | Notes                                |
| ------------------ | ----------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| Backend Logs API   | NestJS controller/service     | `backend/src/logs/`                                                | Supports list + stats only           |
| Persistence        | Prisma + PostgreSQL 16        | `backend/prisma/schema.prisma`                                     | `MessageLog` has no view-state field |
| Frontend Logs Page | React + React Query           | `frontend/src/pages/Logs.tsx`                                      | Has status filter + refresh only     |
| Auth/Tenancy       | JWT + tenant Prisma extension | `backend/src/auth/`, `backend/src/prisma/tenant-prisma.service.ts` | Tenant-scoped behavior required      |

---

## Scope: What's Included & Excluded

### ✅ Included

- Add clear action in logs UI
- Add backend endpoint(s) for log view-state clear marker
- Add tenant-scoped filtering so cleared logs are hidden from list response
- Unit tests for backend log-view-state behavior
- Frontend behavior tests (if test harness exists) or explicit manual validation checklist
- DB migration(s) only if needed by selected approach

### ❌ Excluded

- Physical deletion of `MessageLog` rows
- Changing retention policy or cleanup schedule
- Bulk editing existing message content/status fields

---

## TDD Flow Mode

- **Red → Green → Refactor → Repeat**
- **Test Entry Points**:
  - `backend/src/logs/logs.service.spec.ts`
  - new spec(s) under `backend/src/logs/` for clear action API behavior
  - frontend logs-page test file if project testing stack supports it
- **Approval Gates**:
  - Gate 1: failing tests define clear behavior
  - Gate 2: all targeted tests pass with minimal implementation
  - Gate 3: refactor + tenancy/security checks keep tests green
- **Integration Points**:
  - `Logs.tsx` clear button calls new logs endpoint
  - backend stores/uses clear marker to filter list query

---

## Key Files to Review First

- [backend/src/logs/logs.controller.ts](backend/src/logs/logs.controller.ts)
- [backend/src/logs/logs.service.ts](backend/src/logs/logs.service.ts)
- [backend/src/logs/logs.service.spec.ts](backend/src/logs/logs.service.spec.ts)
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
- [frontend/src/pages/Logs.tsx](frontend/src/pages/Logs.tsx)

---

## Current Test Status

| File                                    | Coverage     | Notes                                  |
| --------------------------------------- | ------------ | -------------------------------------- |
| `backend/src/logs/logs.service.spec.ts` | Partial      | Covers stats counters only             |
| `frontend/src/pages/Logs.tsx` tests     | Unknown/none | No attached page-level tests currently |

---

## Decisions Log

| Decision                                               | Rationale                                          | Status                  |
| ------------------------------------------------------ | -------------------------------------------------- | ----------------------- |
| Use "view-state clear marker" instead of deleting logs | Meets requirement: hidden in UI, preserved in DB   | ✅ Proposed             |
| Prefer tenant-scoped clear marker                      | Prevent cross-tenant visibility leakage            | ✅ Required             |
| Decide storage model: marker table vs per-row `readAt` | Balance migration complexity and query performance | ⏳ Pending final design |
