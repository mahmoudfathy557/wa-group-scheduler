# Task: Event-driven group sync with isLatest + Groups pagination/count

**Task ID**: FEATURE-GROUPS-EVENT-LATEST  
**Created**: 2026-06-20  
**Type**: feature  
**Scope**: full-stack  
**Status**: ⏳ **Pending Start**

---

## Objective

Improve group sync reliability by waiting for Baileys chat hydration (`chats.set` with `isLatest=true`) before pulling group metadata, and improve groups UX with pagination and total count.

**Target Outcome**: Group sync becomes stable after socket hydration, and the Groups page shows total groups plus paginated rows.

---

## Current State Snapshot

| Component            | Version/State       | File Path                                  | Notes                                                      |
| -------------------- | ------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| Framework            | NestJS 11           | `backend/`                                 | WhatsApp sync in service layer                             |
| WhatsApp integration | Baileys 6.7.x       | `backend/src/whatsapp/whatsapp.service.ts` | Uses `groupFetchAllParticipating()`                        |
| Frontend             | React 18 + Vite     | `frontend/src/`                            | Groups page currently unpaginated                          |
| Database             | Prisma + PostgreSQL | `backend/prisma/schema.prisma`             | Group model has `tenantId`, `groupJid`, `participantCount` |

---

## Scope: What's Included & Excluded

### ✅ Included

- Event-driven wait for `chats.set` with `isLatest=true` before group snapshot fetch
- Timeout + retry around group fetch
- Structured logging for group fetch attempts
- Groups page total count display
- Groups page client-side pagination controls

### ❌ Excluded

- Server-side groups pagination endpoint redesign
- New database schema changes
- Socket streaming UI for incremental group hydration

---

## TDD Flow Mode

- **Red → Green → Refactor → Repeat**
- **Test Entry Points**:
  - `backend/src/groups/groups.service.spec.ts`
  - (optional new) `backend/src/whatsapp/whatsapp.service.spec.ts`
- **Approval Gates**:
  - Backend tests pass
  - Frontend build passes
- **Integration Points**:
  - `GroupsService.sync()` depends on `WhatsAppService.listGroups()`
  - `frontend/src/pages/Groups.tsx` consumes `/groups` and `/groups/sync`

---

## Key Files to Review First

- `backend/src/whatsapp/whatsapp.service.ts`
- `backend/src/groups/groups.service.ts`
- `frontend/src/pages/Groups.tsx`
- `backend/src/groups/groups.service.spec.ts`

---

## Current Test Status

| File                                        | Coverage            | Notes                                                         |
| ------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| `backend/src/groups/groups.service.spec.ts` | Existing unit tests | No coverage yet for event wait/retry path in WhatsApp service |

---

## Decisions Log

| Decision                                       | Rationale                                              | Status     |
| ---------------------------------------------- | ------------------------------------------------------ | ---------- |
| Wait for `isLatest` before snapshot fetch      | Reduce incomplete group snapshots after connect        | ✅ Applied |
| Keep `/groups` API contract and paginate in UI | Lowest-risk change, no backend response contract break | ✅ Applied |
