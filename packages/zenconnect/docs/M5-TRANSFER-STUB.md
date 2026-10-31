# M5: Transfer Stub with Validation & ACL Enforcement

**Status:** ✅ Complete  
**Dependencies:** M1 (Identity), M2 (Devices), M3 (ZenControl), M4 (Tasks)

## Overview

M5 completes the transfer file state machine with comprehensive validation:
- SHA-256 digest verification
- Byte count validation  
- M3 folder ACL enforcement on **every** path
- Complete state machine: APPROVED → EXECUTING → SUCCEEDED/FAILED
- Full audit trail of all access checks

## Key Features

### 1. Complete State Machine (M4 Extension)

Added final transitions to `TasksService`:
- `executeTask()`: APPROVED → EXECUTING
- `completeTask()`: EXECUTING → SUCCEEDED
- `failTask()`: EXECUTING → FAILED

### 2. Transfer Execution Service

`TransferExecutionService` orchestrates the complete transfer flow:

```typescript
async executeTransfer(taskId: string): Promise<Task>
```

**Execution Flow:**
1. Validate task is APPROVED and action is `transfer_file`
2. Transition to EXECUTING state
3. **Check source path ACL** (GrantsService.checkGrant)
4. **Check target path ACL** (GrantsService.checkGrant)
5. Perform stub transfer
6. Verify SHA-256 digest
7. Verify byte count
8. Transition to SUCCEEDED or FAILED with clear reason

### 3. SHA-256 Digest Validation (Gate 4)

**Critical requirement:** Digest mismatch → FAILED state, never SUCCEEDED

```typescript
if (actualDigest !== expectedDigest) {
  // → state = FAILED
  // → reason = "Digest mismatch: expected X, got Y"
}
```

Task payload includes:
- `expectedDigest`: SHA-256 hex string
- Transfer result includes:
  - `actualDigest`: computed after transfer

### 4. Byte Count Validation (Gate 4)

```typescript
if (actualByteCount !== expectedByteCount) {
  // → state = FAILED  
  // → reason = "Byte count mismatch: expected X, got Y"
}
```

Task payload includes:
- `expectedByteCount`: number
- Transfer result includes:
  - `actualByteCount`: verified count

### 5. M3 Folder ACL Enforcement (Gate 4 - MVP-04)

**Every transfer path is validated against M3 grants before execution:**

```typescript
// Source path check
const sourceGrantResult = grantsService.checkGrant(
  userId,
  sourceDeviceId,
  ResourceType.FILE_PATH,
  sourcePath,
  Capability.TRANSFER
);

// Target path check  
const targetGrantResult = grantsService.checkGrant(
  userId,
  targetDeviceId,
  ResourceType.FILE_PATH,
  targetPath,
  Capability.TRANSFER
);
```

**Failure scenarios (all → FAILED state):**
- ❌ No grant for source path
- ❌ No grant for target path
- ❌ Grant expired
- ❌ Grant revoked
- ❌ Path outside approved folders
- ❌ Device revoked (M2 integration)
- ❌ Digest mismatch
- ❌ Byte count mismatch

### 6. Transfer Result Structure

Extended `Task` model:

```typescript
interface TransferResult {
  actualDigest?: string;
  actualByteCount?: number;
  sourceGrantChecked: boolean;
  targetGrantChecked: boolean;
  error?: string;
}

interface Task {
  // ... existing fields
  completedAt?: Date;
  transferResult?: TransferResult;
}
```

### 7. Audit Integration

**All checks recorded in M3 AuditService:**
- Source path grant check (GRANTED/DENIED)
- Target path grant check (GRANTED/DENIED)  
- Transfer completion (on success)
- Failure reasons (on any failure)

Example audit query:
```typescript
auditService.query({ userId, deviceId });
// Returns all grant checks and transfer outcomes
```

### 8. Stub Implementation

**Prototype-only:** No real file I/O

```typescript
private async performStubTransfer(task: Task): Promise<{
  actualDigest: string;
  actualByteCount: number;
}> {
  // Simulate delay (100-200ms)
  // Test fixtures can control success/failure via flags:
  // - __testSimulateDigestMismatch
  // - __testSimulateByteCountMismatch
  // Default: return matching values for success path
}
```

## API Changes

### New Endpoint

**POST `/v1/tasks/:taskId/execute`**
- Executes transfer for approved task
- Returns updated task with transferResult
- Requires JWT authentication

### Updated Response

**GET `/v1/tasks/:taskId`** now includes:
```json
{
  "completedAt": "2026-10-31T03:00:00.000Z",
  "transferResult": {
    "actualDigest": "e3b0c44...",
    "actualByteCount": 1024,
    "sourceGrantChecked": true,
    "targetGrantChecked": true
  }
}
```

## Test Coverage

**17 comprehensive test scenarios** in `transfer-execution.service.spec.ts`:

✅ **Success Path:**
- Valid grants + matching digest/bytes → SUCCEEDED

✅ **ACL Failures:**
- No source grant → FAILED
- No target grant → FAILED
- Expired source grant → FAILED
- Expired target grant → FAILED
- Revoked source grant → FAILED
- Revoked target grant → FAILED
- Path outside approved folder → FAILED
- Source device revoked → FAILED
- Target device revoked → FAILED

✅ **Digest/Byte Validation:**
- Digest mismatch → FAILED (NEVER SUCCEEDED)
- Byte count mismatch → FAILED

✅ **Edge Cases:**
- Task not found → error
- Task not APPROVED → error
- Non-transfer_file action → error

✅ **Folder ACL with File Paths:**
- File inside granted folder → SUCCEEDED
- Subfolder paths inside granted folder → SUCCEEDED

## Folder ACL Enforcement Proof (MVP-04 Gate)

**Tests prove ACL is enforced, not just documented:**

1. Tests call `checkGrant()` for both paths
2. Tests verify FAILED state when no grant exists
3. Tests verify audit trail records all checks
4. Tests verify "Access denied" reasons are clear

## Non-Functional Requirements

✅ **Security:** Every path validated, no bypasses  
✅ **Integrity:** Digest and byte validation gates success  
✅ **Audit:** Every ACL check and transfer recorded  
✅ **Clarity:** Clear error messages for each failure type  
✅ **Performance:** Grant checks fast (in-memory M3 lookup)

## Integration Points

- **M1 (Identity):** JWT authentication on execute endpoint
- **M2 (Devices):** Device revocation validated via GrantsService  
- **M3 (ZenControl):** GrantsService and AuditService integration
- **M4 (Tasks):** Extended state machine with EXECUTING/SUCCEEDED/FAILED

## Scope Lock Verified

❌ **NOT included (per PRD):**
- Real file I/O (stub only)
- AI file discovery UX (MVP-04 is enforcement only)
- Journey C / live LLM / summarize
- Shell execution
- Bookings/payments  
- Progress tracking / streaming
- Smart/fuzzy path matching
- iOS/macOS clients

## Acceptance Gate Checklist

- ✅ **Gate 1 (Identity):** Uses M1 JWT auth on execute endpoint
- ✅ **Gate 2 (Devices):** M2 device validation (revoked check) integrated
- ✅ **Gate 3 (Tasks):** M4 state machine completed (EXECUTING/SUCCEEDED/FAILED), No false SUCCEEDED
- ✅ **Gate 4 (Transfer):** 
  - SHA-256 validation ✓
  - Byte count validation ✓
  - M3 folder ACL enforced on EVERY path ✓
  - Digest mismatch → FAILED ✓
  - Byte mismatch → FAILED ✓
- ✅ **NFRs:** All paths checked ✓, Audit trail ✓, Clear errors ✓
- ✅ **Scope lock:** Stub only, no file I/O, no AI discovery, approved folders ENFORCED
- ✅ **Tests:** All failure scenarios ✓, Success path ✓, ACL enforcement proof ✓, Audit recording ✓

## Files Changed

**New Files:**
- `src/transfers/transfer-execution.service.ts`
- `src/transfers/transfer-execution.service.spec.ts`

**Modified Files:**
- `src/common/dto/task.dto.ts` - Added TransferResult, completedAt
- `src/tasks/tasks.service.ts` - Added executeTask, completeTask, failTask
- `src/tasks/tasks.controller.ts` - Added POST /v1/tasks/:taskId/execute
- `src/tasks/tasks.module.ts` - Import TransfersModule
- `src/transfers/transfers.module.ts` - Export TransferExecutionService

**Test Files:**
- All 225 tests pass ✅

## Usage Example

```typescript
// 1. Create grants (M3)
await grantsService.createGrant(userId, {
  deviceId: sourceDeviceId,
  resourceType: ResourceType.FILE_PATH,
  resourcePath: '/home/user/documents/file.txt',
  capabilities: [Capability.TRANSFER],
});

await grantsService.createGrant(userId, {
  deviceId: targetDeviceId,
  resourceType: ResourceType.FILE_PATH,
  resourcePath: '/home/user/backup/file.txt',
  capabilities: [Capability.TRANSFER],
});

// 2. Create transfer_file task (M4)
const task = await tasksService.createTask(userId, {
  sourceDeviceId,
  targetDeviceId,
  actionType: ActionType.TRANSFER_FILE,
  actionPayload: {
    sourcePath: '/home/user/documents/file.txt',
    targetPath: '/home/user/backup/file.txt',
    expectedDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    expectedByteCount: 1024,
  },
});

// 3. Approve task
await tasksService.approveTask(task.taskId, userId);

// 4. Execute transfer (M5)
const result = await transferExecutionService.executeTransfer(task.taskId);

// 5. Check result
if (result.state === TaskState.SUCCEEDED) {
  console.log('Transfer complete:', result.transferResult);
} else {
  console.log('Transfer failed:', result.failureReason);
}

// 6. Query audit trail
const auditEntries = await auditService.query({ userId });
// Returns all grant checks and transfer outcome
```

## Next Steps (Beyond M5)

M5 completes Gates 1-4 for the ZenOne prototype MVP. Future work:
- Real file I/O implementation
- Progress tracking during transfer
- AI-assisted file discovery (MVP-04+)
- Compression/encryption
- Resume capability
- Multi-file batch transfers
