# Task Checklist: Event-driven group sync with isLatest + Groups pagination/count

**Status**: 🔄 In Progress  
**Total Tasks**: 12

---

## Phase 1: Red

- ✅ Define expected `isLatest` behavior for readiness gate
- ✅ Define timeout fallback expectation when `isLatest` not observed
- ⏳ Add explicit backend tests for retry/timeout path (optional follow-up)

---

## Phase 2: Green (Backend)

- ✅ Add `waitForChatsLatest` helper in WhatsApp service
- ✅ Add timeout wrapper around `groupFetchAllParticipating`
- ✅ Add retry loop for empty group snapshots
- ✅ Keep `listGroups` response shape unchanged (`GroupMetadata[]`)

---

## Phase 3: Refactor (Backend)

- ✅ Add env number helper for config parsing
- ✅ Add attempt logging with group count and duration
- ✅ Add delay helper to simplify retry flow

---

## Phase 4: Frontend

- ✅ Add total groups count in Groups header
- ✅ Add page state with fixed page size
- ✅ Add paged row rendering via array slicing
- ✅ Add Prev/Next controls and range indicator

---

## Phase 5: Validation

- ✅ Run backend test suite (`npm test` in `backend/`)
- ✅ Run frontend build (`npm run build` in `frontend/`)
- 🔄 Backend suite has unrelated pre-existing failures; edited files remain type-clean

---

## Dependencies

1. Backend reliability helpers before frontend sync confidence
2. Frontend pagination independent of backend contract changes
3. Validation after all edits
