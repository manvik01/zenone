# M7: Simulated CLI Clients

**Status:** Complete  
**Milestone:** M7  
**Date:** October 31, 2026

## Overview

M7 delivers simulated CLI clients that demonstrate the complete ZenOne happy path end-to-end, from user registration through device pairing, grant management, task creation, and transfer execution.

## Deliverables

### 1. CLI Client Library
**Location:** `tools/cli-clients/src/zen-client.ts`

Provides a TypeScript client library (`ZenClient`) with methods for all ZenConnect APIs:
- Identity (register, login, verify email)
- Devices (pair, list, revoke, update presence)
- ZenControl (create/list/revoke grants, check permissions)
- Tasks (create, approve, cancel, execute, list, get status)

### 2. Automated Demos

#### Happy Path Demo (`demo-happy-path.ts`)
Complete end-to-end flow:
1. User registration and email verification
2. Login from two devices
3. Device pairing for Device A and Device B
4. Grant creation for both devices
5. Transfer file task creation
6. Task approval
7. Task execution with digest validation
8. Task status verification

**Run:** `npm run demo:happy-path`

#### Revocation Demo (`demo-revoke.ts`)
Demonstrates device revocation enforcement:
1. Setup: Register, pair two devices, create grants
2. Create task before revocation (succeeds)
3. Revoke Device B
4. Attempt to create task with revoked device (fails)
5. Verification that revocation blocks both source and target

**Run:** `npm run demo:revoke`

#### Expiry Demo (`demo-expiry.ts`)
Shows task expiry handling:
1. Setup: Register, pair devices, create grants
2. Create task with default expiry
3. Monitor task state (QUEUED → EXPIRED)
4. Demonstrate expired task handling

**Run:** `npm run demo:expiry`

### 3. Interactive CLI Clients

#### Device A Client (`device-a.ts`)
Interactive menu-driven CLI for manual testing:
- Registration (only on Device A)
- Login
- Device pairing
- Grant management
- Task operations
- Device revocation

**Run:** `npm run device-a`

#### Device B Client (`device-b.ts`)
Similar to Device A but without registration:
- Login
- Device pairing
- Grant management
- Task operations

**Run:** `npm run device-b`

### 4. Documentation
**Location:** `tools/cli-clients/README.md`

Complete documentation including:
- Prerequisites and setup
- Quick start guide
- Manual happy path walkthrough
- Environment variables
- Test values (digest/byte count)
- Architecture overview
- API coverage checklist
- Troubleshooting guide

## API Coverage

The clients demonstrate all M1-M6 functionality:

| Milestone | Feature | Coverage |
|-----------|---------|----------|
| M1 | Identity | ✓ Register, verify, login, sessions |
| M2 | Devices | ✓ Pair, list, revoke, presence |
| M3 | ZenControl | ✓ Grants, ACL enforcement |
| M4 | Tasks | ✓ Create, approve, execute, status, expiry |
| M5 | Transfer | ✓ Execution, digest validation, ACL |
| M6 | Expiry/Recheck | ✓ Expiry demonstrated |

## Testing

### Successful Test Runs

**Happy Path Demo:**
```
✅ Happy Path Demo Complete!
All steps completed successfully!
```

**Revocation Demo:**
```
✅ Revocation Demo Complete
Device revocation enforcement demonstrated!

Key findings:
  ✓ Tasks can be created before device revocation
  ✓ Revoked devices cannot be used as target
  ✓ Revoked devices cannot be used as source
  ✓ Revocation is enforced at task creation time
```

### Gate Coverage

- **Gate 1 (Identity):** ✓ Register/login from two clients
- **Gate 2 (Devices):** ✓ Pair/list/revoke, revoked device blocked
- **Gate 3 (Tasks):** ✓ Create/approve/status, expiry demonstrated
- **Gate 4 (Transfer):** ✓ Execute with digest validation, ACL enforcement

## Prerequisites

1. ZenConnect server running on http://localhost:3000
2. Node.js and npm installed
3. Dependencies installed: `cd tools/cli-clients && npm install`

## Quick Start

```bash
# Start ZenConnect server
cd packages/zenconnect
npm run start:dev

# Run automated demos
cd tools/cli-clients
npm run demo:happy-path    # Complete end-to-end flow
npm run demo:revoke        # Revocation enforcement
npm run demo:expiry        # Task expiry

# Or use interactive clients
npm run device-a           # Device A interactive CLI
npm run device-b           # Device B interactive CLI
```

## Architecture

```
tools/cli-clients/
├── src/
│   ├── zen-client.ts          # Shared API client library
│   ├── demo-happy-path.ts     # Automated happy path
│   ├── demo-revoke.ts         # Revocation demo
│   ├── demo-expiry.ts         # Expiry demo
│   ├── device-a.ts            # Interactive CLI A
│   └── device-b.ts            # Interactive CLI B
├── package.json
├── tsconfig.json
└── README.md
```

## Bug Fixes

Fixed two issues in ZenConnect during M7 development:

1. **tasks.module.ts:** Corrected import name from `ZencontrolModule` to `ZenControlModule`
2. **zencontrol.controller.ts:** Added missing `JwtAuthGuard` and `IdentityModule` import to enforce authentication

## Test Values

For reproducible testing, the automated demos use:
- **Test Content:** `"Hello from ZenOne!"`
- **SHA-256 Digest:** `f3da1f2efbf235f7e38e924dd2ff5fa8007c50ddae480009825fa7395334cbbf`
- **Byte Count:** `18`

## Scope Lock Verification

✓ **Simulated clients only** - No real Android/Windows apps  
✓ **No Journey C** - No conversation sync  
✓ **No LLM/AI router**  
✓ **No shell execution**  
✓ **No bookings/payments**  
✓ **Simple UI** - CLI only, no sophisticated UI

## Next Steps

The simulated clients are ready for demonstration and can be used to:
1. Validate the prototype end-to-end
2. Test new features as they're added
3. Demonstrate ZenOne capabilities
4. Serve as integration test examples

## Related Documents

- [Acceptance Gates](/docs/acceptance-gates.md)
- [CLI Clients README](../tools/cli-clients/README.md)
