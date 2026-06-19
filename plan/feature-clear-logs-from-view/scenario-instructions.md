# Task: Clear Logs from View Feature

**Task ID**: FEATURE-LOGS-CLEAR-VIEW  
**Created**: 2026-06-19  
**Type**: feature  
**Scope**: full-stack  
**Status**: ✅ **Ready for Execution**

---

## Objective

Implement a "clear logs from view" feature that hides logs viewed before a certain timestamp, allowing users to focus on recent logs without deleting data. Logs are soft-deleted from the user's view via a `LogViewState` marker.

**Target Outcome**:

- User clicks "Clear Logs" button → logs before that moment are hidden from `/logs` view
- Old logs remain in DB (for auditing/compliance)
- Endpoint: `POST /logs/clear-view` (backend)
- Button: "Clear Logs" in `Logs.tsx` (frontend)
- Multi-tenant safe: each tenant has own `LogViewState`

---

## Current State Snapshot

| Component   | Version/State          | File Path                      | Notes                               |
| ----------- | ---------------------- | ------------------------------ | ----------------------------------- |
| Framework   | NestJS 10 + Bull Queue | `backend/`                     | Message processing via BullMQ       |
| Database    | Prisma + PostgreSQL 16 | `backend/prisma/schema.prisma` | Multi-tenant via `tenantId`         |
| Frontend    | React 18 + Vite        | `frontend/src/`                | Real-time via Socket.IO             |
| Auth        | JWT (12h expiry)       | `backend/src/auth/`            | Tenant-scoped                       |
| Logs Module | Partially built        | `backend/src/logs/`            | Controllers, services, schema exist |

---

## Scope: What's Included & Excluded

### ✅ Included

- Backend: `LogViewState` model (tenant-scoped, tracks `clearedAt` timestamp)
- Backend: `POST /logs/clear-view` endpoint (authenticated, sets `clearedAt` for tenant)
- Backend: Modify `GET /logs` query to filter `createdAt > tenant.logViewState.clearedAt`
- Backend: Unit tests for clear-view logic
- Backend: Integration tests for multi-tenant isolation
- Frontend: "Clear Logs" button in `Logs.tsx`
- Frontend: Call `POST /logs/clear-view` on click, refresh logs list
- Frontend: Confirmation dialog before clearing (UX best practice)
- Database: Migration to add `LogViewState` table (if not exists)

### ❌ Excluded

- Permanent log deletion (out of scope—logs archive separately)
- Bulk delete API endpoint (only clear-view supported)
- Log retention policy automation (manual clear only)
- Frontend log export feature (separate task)

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
