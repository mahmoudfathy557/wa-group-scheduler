# Multi-User Tenant Access Implementation Plan

## Overview

Transform WA-Scheduler from a **1:1 user-to-tenant model** to a **many-to-one model** where multiple users can collaborate within the same tenant. This plan enables team workspaces with invite-link-based onboarding, full data sharing, and equal access for all team members.

### Key Scope Decisions

- ✅ **Team workspace model**: Multiple users share one tenant
- ✅ **No roles initially**: Everyone has equal access (Owner/Admin/Member can be added later)
- ✅ **Invite links**: Shareable 7-day invite tokens (email delivery can be added later)
- ✅ **Greenfield feature**: No migration needed—new capability before launch

---

## Architecture Overview

```
Current State (1:1)       →        Target State (Many-to-One)
─────────────────────────         ──────────────────────────
User ←──1:1──→ Tenant            User ←─╮
                                         ├─ TenantMember ─→ Tenant
                                User ←─╯

Data Access:
   User A  ──┐
   User B  ──┼─→ [TenantPrisma Extension] ──→ Tenant X Data
   User C  ──┘
```

### Key Models

1. **User**: Account credentials (email, passwordHash) — **no longer has unique tenantId**
2. **TenantMember**: Junction table tracking membership, invite status, and lifecycle
3. **Tenant**: Team workspace (unchanged, but now supports many members)

---

## Implementation Phases

### Phase 1: Database Schema Changes (Blocking)

**Timeline**: ~1-2 hours  
**Complexity**: Low  
**Blocker for**: Phase 2, Phase 3

#### 1.1 Modify User Model

**File**: `backend/prisma/schema.prisma` (lines 30–37)

**Changes**:

- Remove `@unique` constraint from `tenantId` field
- Add `@index(["tenantId"])` for query performance on membership lookups
- User can now belong to multiple tenants (via TenantMember records)

**Before**:

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  tenantId     String   @unique
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
}
```

**After**:

```prisma
model User {
  id              String          @id @default(cuid())
  email           String          @unique
  passwordHash    String
  tenantMembers   TenantMember[]  // Relation to memberships
  createdAt       DateTime        @default(now())
}
```

#### 1.2 Create TenantMember Junction Table

**File**: `backend/prisma/schema.prisma` (new section)

**Purpose**: Track user membership, pending invites, and membership lifecycle

**Schema**:

```prisma
model TenantMember {
  id            String   @id @default(cuid())
  tenantId      String
  userId        String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Invite lifecycle
  inviteToken   String?  @unique  // Null for active members, set for pending
  inviteExpiresAt DateTime?       // When invite expires (7 days from generation)
  status        String   @default("active")  // "active" | "pending" | "deleted"

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Ensure user can't be invited twice to same tenant
  @@unique([tenantId, userId])
}
```

**Add relation to Tenant**:

```prisma
model Tenant {
  id              String          @id @default(cuid())
  name            String
  timezone        String          @default("UTC")
  members         TenantMember[]  // New relation
  // ... existing relations (sessions, groups, schedules, etc.)
  createdAt       DateTime        @default(now())
}
```

#### 1.3 Create Database Migration

**File**: `backend/prisma/migrations/202606XX_add_tenant_members/migration.sql` (new)

**Steps**:

1. Create `TenantMember` table with all constraints
2. Backfill existing users: For each User record, create active TenantMember
3. Remove unique constraint from User.tenantId
4. Add index on User.tenantId (optional, but recommended for performance)

**Rough SQL structure**:

```sql
-- Create TenantMember table
CREATE TABLE "TenantMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inviteToken" TEXT,
  "inviteExpiresAt" TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  UNIQUE("tenantId", "userId"),
  UNIQUE("inviteToken")
);

-- Backfill: Create TenantMember for each existing user
INSERT INTO "TenantMember" (id, "tenantId", "userId", status)
SELECT cuid(), "tenantId", id, 'active' FROM "User";

-- Remove @unique from User.tenantId (varies by database)
ALTER TABLE "User" DROP CONSTRAINT "User_tenantId_key";

-- Add index
CREATE INDEX "TenantMember_tenantId_idx" ON "TenantMember"("tenantId");
```

---

### Phase 2: Auth Layer Updates (Blocking for Phase 3)

**Timeline**: ~2-3 hours  
**Complexity**: Medium  
**Blocker for**: Phase 3

#### 2.1 Update JWT Strategy

**File**: `backend/src/auth/jwt.strategy.ts` (lines 19–30)

**Current Logic**:

- Query User by `id` + `tenantId` (assumes 1:1)
- Throws if not found

**New Logic**:

1. Extract `sub` (userId) and `tenantId` from JWT payload
2. Query User by `id` alone
3. Query TenantMember to verify user has active membership in requested `tenantId`
4. Throw if TenantMember not found or status ≠ "active"
5. Add `tenantMemberId` to returned payload (for audit trails)

**Why**: Cleanly separates "user exists" from "user can access this tenant"

**Pseudocode**:

```typescript
// Before
const user = await this.prisma.user.findUnique({
  where: { id: payload.sub, tenantId: payload.tenantId }
});

// After
const user = await this.prisma.user.findUnique({
  where: { id: payload.sub }
});

const membership = await this.prisma.tenantMember.findFirst({
  where: {
    userId: user.id,
    tenantId: payload.tenantId,
    status: "active"
  }
});

if (!membership) throw new UnauthorizedException("...");

return {
  userId: user.id,
  tenantId: payload.tenantId,
  tenantMemberId: membership.id,
  email: user.email
};
```

#### 2.2 Update Current-User Decorator

**File**: `backend/src/auth/current-user.decorator.ts`

**Changes**:

- Return type now includes `tenantMemberId` (extracted from JWT)
- No logic changes; purely a typed struct update

**Before**:

```typescript
export interface AuthUser {
  userId: string;
  tenantId: string;
  email: string;
}
```

**After**:

```typescript
export interface AuthUser {
  userId: string;
  tenantId: string;
  tenantMemberId: string; // New field
  email: string;
}
```

#### 2.3 Create Tenant-User Validation Guard

**File**: `backend/src/auth/tenant-user.guard.ts` (new)

**Purpose**: Validate that user requesting access to `tenantId` (via route param) is an active member

**Usage Pattern**:

```typescript
@Controller("api/tenants/:tenantId")
@UseGuards(JwtAuthGuard, TenantUserGuard)
export class TenantsController {
  @Get("/members")
  getMembers(@Param("tenantId") tenantId: string) {
    // Guard ensures user is member of tenantId
  }
}
```

**Guard Logic**:

1. Extract `tenantId` from route params
2. Extract `userId` from JWT (via req.user)
3. Query TenantMember for `(tenantId, userId, status="active")`
4. Throw `ForbiddenException` if not found

---

### Phase 3: Invite Link Feature

**Timeline**: ~4-5 hours  
**Complexity**: Medium-High  
**Depends on**: Phase 1, Phase 2

#### 3.1 Create Tenant Invite Service

**File**: `backend/src/tenants/tenant-invite.service.ts` (new)

**Methods**:

##### `generateInviteLink(tenantId: string, invitedByUserId: string)`

- Creates TenantMember record with `status="pending"`, generates unique token, sets expiry
- Returns invite link: `https://app.wa-scheduler.com/register?inviteToken=<TOKEN>`
- Token format: Cryptographically secure random string (e.g., 32 bytes hex-encoded)

```typescript
async generateInviteLink(tenantId: string): Promise<{ link: string; token: string }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const member = await this.prisma.tenantMember.create({
    data: {
      tenantId,
      userId: '...', // Pending user ID (TBD: use placeholder or null?)
      inviteToken: token,
      inviteExpiresAt: expiresAt,
      status: 'pending'
    }
  });

  const link = `https://app.wa-scheduler.com/register?inviteToken=${token}`;
  return { link, token };
}
```

##### `validateInviteToken(token: string)`

- Looks up TenantMember by token
- Checks expiry
- Returns `{ tenantId, status }` or throws

```typescript
async validateInviteToken(token: string) {
  const member = await this.prisma.tenantMember.findUnique({
    where: { inviteToken: token }
  });

  if (!member) throw new NotFoundException('Invalid invite token');
  if (member.inviteExpiresAt < new Date()) throw new BadRequestException('Invite expired');

  return { tenantId: member.tenantId, memberId: member.id };
}
```

##### `acceptInvite(token: string, userId: string)`

- Atomically updates TenantMember: set `userId`, `status="active"`, clear `inviteToken` and `inviteExpiresAt`
- Validates token before accepting

```typescript
async acceptInvite(token: string, userId: string) {
  await this.validateInviteToken(token);

  return this.prisma.tenantMember.update({
    where: { inviteToken: token },
    data: {
      userId,
      status: 'active',
      inviteToken: null,
      inviteExpiresAt: null
    }
  });
}
```

##### `rejectInvite(token: string)`

- Deletes pending TenantMember record

```typescript
async rejectInvite(token: string) {
  return this.prisma.tenantMember.delete({
    where: { inviteToken: token }
  });
}
```

**Configuration**:

```typescript
// In module or .env
INVITE_EXPIRY_DAYS = 7; // Default 7 days, configurable
```

#### 3.2 Create Tenant Members Controller

**File**: `backend/src/tenants/tenant-members.controller.ts` (new)

**Endpoints**:

| Endpoint                                   | Method | Auth        | Purpose                             |
| ------------------------------------------ | ------ | ----------- | ----------------------------------- |
| `/api/tenants/:tenantId/members`           | GET    | ✅ Required | List active members                 |
| `/api/tenants/:tenantId/members/:memberId` | DELETE | ✅ Required | Remove member from tenant           |
| `/api/tenants/:tenantId/invites`           | POST   | ✅ Required | Generate invite link                |
| `/api/auth/invites/:token/accept`          | POST   | ❌ Public   | Accept pending invite (new user)    |
| `/api/auth/invites/:token/info`            | GET    | ❌ Public   | Check invite validity + tenant name |

**Example Implementations**:

```typescript
@Controller("api/tenants/:tenantId")
@UseGuards(JwtAuthGuard, TenantUserGuard)
export class TenantMembersController {
  constructor(private tenantInviteService: TenantInviteService) {}

  // List active members
  @Get("/members")
  async getMembers(@Param("tenantId") tenantId: string) {
    return this.prisma.tenantMember.findMany({
      where: { tenantId, status: "active" },
      include: { user: { select: { email: true } } }
    });
  }

  // Remove member
  @Delete("/members/:memberId")
  async removeMember(@Param("memberId") memberId: string) {
    return this.prisma.tenantMember.update({
      where: { id: memberId },
      data: { status: "deleted" } // Soft delete
    });
  }

  // Generate invite
  @Post("/invites")
  async generateInvite(@Param("tenantId") tenantId: string) {
    const { link } =
      await this.tenantInviteService.generateInviteLink(tenantId);
    return { inviteLink: link };
  }
}

@Controller("api/auth")
export class AuthMembersController {
  // Accept invite (during registration)
  @Post("/invites/:token/accept")
  async acceptInvite(
    @Param("token") token: string,
    @Body() body: { userId: string }
  ) {
    return this.tenantInviteService.acceptInvite(token, body.userId);
  }

  // Check invite validity
  @Get("/invites/:token/info")
  async getInviteInfo(@Param("token") token: string) {
    const { tenantId } =
      await this.tenantInviteService.validateInviteToken(token);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    return { tenantName: tenant.name, tenantId };
  }
}
```

#### 3.3 Update Auth Controller

**File**: `backend/src/auth/auth.service.ts`

**Changes to `register()` method**:

- Accept optional `inviteToken` query param
- If provided: Validate token → extract `tenantId` → create User → accept invite (atomically)
- If not provided: Create User + Tenant (current behavior)

**Pseudocode**:

```typescript
async register(email: string, password: string, inviteToken?: string) {
  // Check if user exists
  const existingUser = await this.prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new BadRequestException('User already exists');

  if (inviteToken) {
    // Invited user flow
    const { tenantId } = await this.tenantInviteService.validateInviteToken(inviteToken);

    const user = await this.prisma.user.create({
      data: { email, passwordHash: hash(password) }
    });

    await this.tenantInviteService.acceptInvite(inviteToken, user.id);

    return { user, tenantId };
  } else {
    // New tenant owner flow
    const tenant = await this.prisma.tenant.create({
      data: { name: email.split('@')[0] }  // Default name
    });

    const user = await this.prisma.user.create({
      data: { email, passwordHash: hash(password) }
    });

    await this.prisma.tenantMember.create({
      data: { tenantId: tenant.id, userId: user.id, status: 'active' }
    });

    return { user, tenantId: tenant.id };
  }
}
```

---

### Phase 4: Frontend UI Updates

**Timeline**: ~3-4 hours  
**Complexity**: Medium  
**Depends on**: Phase 1, Phase 3 (APIs)

#### 4.1 Add Team Members Page

**File**: `frontend/src/pages/TenantMembers.tsx` (new)

**Features**:

- List active members with email and join date
- Show pending invites (if any) with expiry countdown
- "Generate Invite Link" button (copy-to-clipboard)
- "Remove Member" button for each active member (soft-delete confirmation)

**Component Structure**:

```tsx
export function TenantMembers() {
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteLink, setInviteLink] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, [tenantId]);

  const handleGenerateInvite = async () => {
    const response = await api.post(`/tenants/${tenantId}/invites`);
    setInviteLink(response.inviteLink);
  };

  const handleRemoveMember = async (memberId) => {
    await api.delete(`/tenants/${tenantId}/members/${memberId}`);
    fetchMembers();
  };

  return (
    <div>
      <h1>Team Members</h1>

      <section>
        <h2>Active Members ({members.length})</h2>
        <table>
          {members.map((m) => (
            <tr key={m.id}>...</tr>
          ))}
        </table>
      </section>

      <section>
        <h2>Pending Invites ({pendingInvites.length})</h2>
        {pendingInvites.map((p) => (
          <div key={p.id}>
            Expires: {formatDate(p.inviteExpiresAt)}
            <button onClick={() => rejectInvite(p.id)}>Revoke</button>
          </div>
        ))}
      </section>

      <section>
        <button onClick={handleGenerateInvite}>Generate Invite Link</button>
        {inviteLink && <CopyableInput value={inviteLink} />}
      </section>
    </div>
  );
}
```

#### 4.2 Update Register Flow

**File**: `frontend/src/pages/Register.tsx`

**Changes**:

- Detect `inviteToken=xyz` in URL query params
- If present, fetch invite info via `GET /api/auth/invites/:token/info` to show tenant name
- Pass token to `POST /auth/register` payload
- On success, redirect to dashboard (not onboarding)

**Pseudocode**:

```tsx
export function Register() {
  const searchParams = new URLSearchParams(window.location.search);
  const inviteToken = searchParams.get('inviteToken');
  const [tenantName, setTenantName] = useState(null);

  useEffect(() => {
    if (inviteToken) {
      api.get(`/auth/invites/${inviteToken}/info`).then(data => {
        setTenantName(data.tenantName);
      });
    }
  }, [inviteToken]);

  const handleRegister = async (email, password) => {
    const response = await api.post('/auth/register', {
      email,
      password,
      inviteToken  // Include if present
    });

    localStorage.setItem('token', response.token);
    navigate('/dashboard');
  };

  return (
    <form onSubmit={e => handleRegister(...)}>
      {tenantName && <p>Join <strong>{tenantName}</strong></p>}
      <input type="email" placeholder="Email" />
      <input type="password" placeholder="Password" />
      <button type="submit">Register</button>
    </form>
  );
}
```

#### 4.3 Update App Layout

**File**: `frontend/src/App.tsx` (main nav)

**Changes**:

- Add link to "Team Members" next to "Groups", "Logs"
- Show member count badge
- Visible only for authenticated users (all users in multi-tenant already see it)

```tsx
<nav>
  <Link to="/dashboard">Dashboard</Link>
  <Link to="/groups">Groups</Link>
  <Link to="/logs">Logs</Link>
  <Link to="/team-members">
    Team Members <Badge>{memberCount}</Badge>
  </Link>
</nav>
```

---

### Phase 5: Tenant-Aware Endpoints & Data Isolation Validation

**Timeline**: ~2-3 hours  
**Complexity**: Low-Medium  
**Depends on**: Phase 1, Phase 2

#### 5.1 Verify Tenant-Prisma Extension

**File**: `backend/src/prisma/tenant-prisma.service.ts`

**Status**: ✅ No changes needed

The existing extension already auto-injects `tenantId` into queries for all models in `TENANT_MODELS`. It will work seamlessly with many users per tenant.

**Verification**:

- Create 2 users in same tenant
- Verify both users see same data (groups, schedules, logs)
- Verify User A in Tenant X cannot see User B's Tenant Y data

#### 5.2 Audit Endpoints for Tenant Safety

**Scope**: All controllers that accept `tenantId` as route param

**Pattern**: Apply `@UseGuards(JwtAuthGuard, TenantUserGuard)` to all route handlers

**Example audit checklist**:

- ✅ `/api/tenants/:tenantId/groups` — Add guard
- ✅ `/api/tenants/:tenantId/schedules` — Add guard
- ✅ `/api/tenants/:tenantId/logs` — Add guard
- ✅ `/api/tenants/:tenantId/members` — Add guard (new)

#### 5.3 Update Routes Referencing Current User's Tenant

**Pattern**: Routes that extract `tenantId` from JWT should also verify membership

**Before**:

```typescript
@Get('/my-data')
getMyData(@CurrentUser() user: AuthUser) {
  // Trusts user.tenantId from JWT
  return this.prisma.groups.findMany({
    where: { tenantId: user.tenantId }
  });
  // ❌ Vulnerable if tenantId is tampered
}
```

**After**:

```typescript
@Get('/my-data')
@UseGuards(JwtAuthGuard, TenantUserGuard)  // Guard adds verification
getMyData(@CurrentUser() user: AuthUser) {
  // Guard already verified user.tenantId is valid
  return this.prisma.groups.findMany({
    where: { tenantId: user.tenantId }
  });
  // ✅ Safe
}
```

---

### Phase 6: Testing & Validation

**Timeline**: ~4-5 hours  
**Complexity**: Medium  
**Depends on**: Phase 1–5

#### 6.1 Unit Tests

**JWT Strategy** (`backend/src/auth/jwt.strategy.spec.ts`):

- Test valid user with active membership → returns AuthUser with tenantMemberId
- Test user with expired/deleted membership → throws UnauthorizedException
- Test invalid token → throws UnauthorizedException

**Tenant-User Guard** (`backend/src/auth/tenant-user.guard.ts.spec.ts`):

- Test user with valid membership → passes guard
- Test user without membership → throws ForbiddenException
- Test cross-tenant access attempt → throws ForbiddenException

**Tenant Invite Service** (`backend/src/tenants/tenant-invite.service.spec.ts`):

- Test `generateInviteLink()` → creates pending member, returns shareable link
- Test `validateInviteToken()` with valid token → returns tenantId
- Test `validateInviteToken()` with expired token → throws error
- Test `acceptInvite()` → atomically updates status, clears token
- Test `rejectInvite()` → deletes pending record

**Tenant Members Controller** (`backend/src/tenants/tenant-members.controller.spec.ts`):

- Test `GET /members` → returns active members
- Test `POST /invites` → generates invite link
- Test `DELETE /members/:memberId` → removes member (soft delete)

#### 6.2 Integration Tests

**E2E: Full Invite Flow**:

1. User A creates tenant (via register without invite)
2. User A generates invite link
3. User B clicks link, sees tenant name on register page
4. User B registers with invite token
5. User A + User B both logged in
6. Both see same data (groups, schedules, logs)
7. ✅ Verify: User B cannot access User A's Tenant Y data

**E2E: Expired Invite**:

1. Generate invite link
2. Manually set `inviteExpiresAt` to past date
3. Attempt to accept invite
4. ✅ Verify: Throws "Invite expired" error

**E2E: Removed Member**:

1. User A + User B in Tenant X
2. User A removes User B
3. User B tries to access Tenant X resources
4. ✅ Verify: Throws ForbiddenException

#### 6.3 Manual Testing Checklist

- [ ] Create new tenant (no invite)
- [ ] Generate invite link from Team Members page
- [ ] Copy link, share with test user
- [ ] Accept invite as test user
- [ ] Verify both users see same data
- [ ] Test member list shows both users
- [ ] Remove test user, verify access denied
- [ ] Test expired invite rejection
- [ ] Test team members badge shows count
- [ ] Test navigation to Team Members visible

---

## Relevant Files Reference

### Core Files to Modify

| File                                         | Change Type  | Purpose                           |
| -------------------------------------------- | ------------ | --------------------------------- |
| `backend/prisma/schema.prisma`               | Modify + Add | User model + TenantMember table   |
| `backend/prisma/migrations/`                 | Add          | Database migration script         |
| `backend/src/auth/jwt.strategy.ts`           | Modify       | JWT validation logic              |
| `backend/src/auth/current-user.decorator.ts` | Modify       | Add tenantMemberId to AuthUser    |
| `backend/src/auth/auth.service.ts`           | Modify       | Register flow with invite support |

### New Files to Create

| File                                                    | Purpose                             |
| ------------------------------------------------------- | ----------------------------------- |
| `backend/src/auth/tenant-user.guard.ts`                 | Cross-tenant access prevention      |
| `backend/src/tenants/tenant-invite.service.ts`          | Invite link generation + validation |
| `backend/src/tenants/tenant-invite.service.spec.ts`     | Invite service unit tests           |
| `backend/src/tenants/tenant-members.controller.ts`      | Member & invite endpoints           |
| `backend/src/tenants/tenant-members.controller.spec.ts` | Controller unit tests               |
| `frontend/src/pages/TenantMembers.tsx`                  | Team members UI                     |
| `backend/src/tenants/`                                  | New module directory                |

### Data Models

- **Schema**: `backend/prisma/schema.prisma` — User + TenantMember + Tenant
- **Auth Flow**: `backend/src/auth/jwt.strategy.ts`, `backend/src/auth/auth.service.ts`
- **Tenant Isolation**: `backend/src/prisma/tenant-prisma.service.ts` (no changes needed)
- **All Controllers**: `backend/src/*` that accept `tenantId` param

---

## Verification Checklist

Before considering this feature complete, verify:

- [ ] **Unit tests pass**: Auth strategy + invite service + members controller
- [ ] **Integration flow**: Invite → Accept → Access = all users see same tenant data
- [ ] **Isolation test**: User in Tenant A cannot read/write to Tenant B
- [ ] **Invite lifecycle**: Generated → Valid → Expired → Rejected
- [ ] **Token security**: Tokens are cryptographically secure (not guessable)
- [ ] **UI flow**: Invite link redirects to register → pre-fills tenant name → user lands in dashboard
- [ ] **Member removal**: Removed members cannot access tenant resources
- [ ] **Backward compat**: Existing 1:1 users are backfilled to TenantMember (no data loss)
- [ ] **Performance**: TenantMember queries don't degrade auth latency

---

## Design Decisions & Rationale

### 1. No Roles Initially

**Decision**: Everyone in a tenant has full access (owner, admin, members all equal)

**Rationale**:

- Simplifies implementation (reduces scope)
- Covers 80% of use cases (team collaboration)
- Role-based access control (RBAC) can be added as Phase 7 without breaking existing code
- Existing TenantMember table structure already supports roles via a future `role` field

### 2. Invite Token Flow (Email-Less MVP)

**Decision**: Share invite links manually; email delivery optional

**Rationale**:

- Faster MVP (no email service integration)
- Users can copy/paste or use QR codes
- Email delivery can be added later as Phase 7 without rearchitecting
- Reduces external dependencies

### 3. Invite Expiry: 7 Days

**Decision**: Tokens expire after 7 days

**Rationale**:

- Long enough for manual sharing
- Short enough to prevent stale links in production
- Configurable via env var for different security postures

### 4. TenantMember Junction Table

**Decision**: Use explicit junction table instead of embedding status in User

**Rationale**:

- Cleanly separates "user account" from "tenant membership"
- Enables future features: role tracking, member history, re-invites, audit logs
- Allows multiple pending invites (edge case: user A invites same email twice)
- Better for data integrity and audit trails

### 5. Soft-Delete for Removed Members

**Decision**: Set `status="deleted"` instead of hard-deleting

**Rationale**:

- Preserves audit trail (who was member when)
- Allows re-joining scenarios
- Supports compliance/audit requirements
- Can be changed to hard-delete later if storage becomes concern

---

## Further Considerations

### Unanswered Questions

1. **Production Rollout**: Should existing 1:1 users be auto-migrated to the multi-user model, or is this a fresh feature post-launch?
   - _Impact_: Determines data migration complexity, backfill testing

2. **Invite Permissions**: Who should be able to invite users?
   - Current plan: Any member can invite
   - Alternative: Only tenant creator/owner (requires roles, Phase 7)
   - _Impact_: May affect Phase 3 design

3. **Invite Link Reusability**: Should invite links be 1-time or reusable?
   - Current plan: 1-time (token consumed on accept)
   - Alternative: Reusable (new endpoint to "revoke" link)
   - _Impact_: Affects TenantMember schema, invite lifecycle

4. **Email Notifications**: Should we send emails for invites?
   - Current plan: No (manual sharing)
   - Alternative: Integrate SendGrid or similar (Phase 7)
   - _Impact_: New external dependency, Phase 7 effort

5. **Member Limits**: Should there be a cap on team members?
   - Current plan: Unlimited
   - Alternative: Enforce limits per tier (freemium model)
   - _Impact_: Affects controller validation logic

### Future Phases (Post-MVP)

**Phase 7: Role-Based Access Control (RBAC)**

- Add `role` field to TenantMember (Owner, Admin, Member, Guest)
- Restrict invite permissions to Owner/Admin only
- Restrict group/schedule editing by role

**Phase 8: Email Notifications**

- Integrate SendGrid/AWS SES
- Send invite emails with pre-filled token
- Send join/leave notifications to team

**Phase 9: Activity Auditing**

- Log all member actions (invite, accept, remove)
- Expose audit log via UI
- Export for compliance

**Phase 10: Single Sign-On (SSO)**

- Support Google/Microsoft OAuth for team onboarding
- Auto-provision users from domain

---

## Timeline & Effort Estimate

| Phase               | Duration      | Effort      | Blocker            |
| ------------------- | ------------- | ----------- | ------------------ |
| Phase 1: Schema     | 1–2 hrs       | Low         | ✅ Blocks Ph2, Ph3 |
| Phase 2: Auth       | 2–3 hrs       | Medium      | ✅ Blocks Ph3      |
| Phase 3: Invites    | 4–5 hrs       | Medium-High | Blocks Ph4         |
| Phase 4: UI         | 3–4 hrs       | Medium      | Dependent on Ph3   |
| Phase 5: Validation | 2–3 hrs       | Low-Medium  | Quality gate       |
| Phase 6: Testing    | 4–5 hrs       | Medium      | Release gate       |
| **Total**           | **16–22 hrs** | **Medium**  | **1–2 sprint**     |

---

## Deployment Strategy

### Local Development

1. Apply Phase 1 migration: `npx prisma migrate dev --name add_tenant_members`
2. Seed with test data (e.g., 2 users in 1 tenant)
3. Run auth strategy tests: `npm test backend/src/auth`
4. Run invite service tests: `npm test backend/src/tenants`

### Staging

1. Run full integration test suite
2. Manual E2E: Invite → Accept → Access
3. Load testing (n=100 concurrent users)

### Production

1. Backfill existing users: `npx prisma migrate deploy`
2. Deploy backend (auth changes)
3. Deploy frontend (UI changes)
4. Monitor: Auth latency, TenantMember query performance
5. Rollback plan: If issues, revert to v1 (single-user model) via feature flag

---

## Notes

- This plan assumes PostgreSQL (Prisma). Adjust SQL for other databases.
- Cryptographic token generation uses Node.js `crypto.randomBytes()`.
- `TenantPrismaService` extension already supports many users per tenant—no changes needed.
- All references to "backfill", "migration", "deploy" are from the perspective of a greenfield feature (no existing multi-user data).
