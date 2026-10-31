# M6: QUEUED Status with Expiry and Auth Recheck

## Overview
M6 implements robust task lifecycle hardening with offline handling, expiry enforcement, and pre-execution validation of device trust and grants.

## Features Implemented

### 1. QUEUED State with Expiry
- Tasks automatically enter QUEUED state when created (for transfer_file)
- `expiresAt` timestamp set to 24 hours from creation (configurable)
- Task model includes `expiresAt` field from M4

### 2. Expiry Enforcement
- Background check via `checkAndExpireTasks()` method
- Tasks past their deadline transition to EXPIRED state
- EXPIRED tasks cannot transition to SUCCEEDED (state machine enforces this)
- Clear expiry timestamp available in task response

### 3. Device Revocation Recheck
Before execution, the system validates:
- Target device exists and is not revoked
- Source device exists and is not revoked
- Fails task with clear error if device is revoked
- Records failure in audit trail

### 4. Grant Recheck
Before execution, the system validates:
- Source path grant is still valid (not revoked/expired)
- Target path grant is still valid (not revoked/expired)
- Uses `GrantsService.checkGrant()` for validation
- Fails task with clear error if grants are invalid
- Records failure in audit trail

### 5. Pre-Execution Validation Flow
New method `executeTaskWithValidation()`:
```typescript
async executeTaskWithValidation(taskId: string): Promise<Task> {
  // 1. Check device trust status (source and target)
  // 2. Recheck grants for transfer_file tasks
  // 3. Record validation result in audit trail
  // 4. If validation fails, fail the task
  // 5. If validation passes, proceed to EXECUTING state
}
```

### 6. State Machine Updates
Updated valid transitions:
- `APPROVED → FAILED` now allowed (for pre-execution validation failures)
- Existing transitions preserved

### 7. User-Visible Behavior
- GET /v1/tasks shows QUEUED, EXPIRED, CANCELED tasks
- GET /v1/tasks/:taskId shows expiry timestamp and failure reasons
- POST /v1/tasks/:taskId/cancel works for QUEUED tasks
- Clear error messages for all validation failures

### 8. Offline Detection
For prototype:
- Uses M2 device presence via `isOnline` flag
- Device with `isOnline = false` → task goes to QUEUED
- Production would use more sophisticated presence/push

## Integration Points

### M2 Devices
- `DevicesService.findById()` - check device exists and trust status
- `DevicesService.isDeviceOnline()` - check device presence

### M3 Grants
- `GrantsService.checkGrant()` - validate grants before execution
- Checks both source and target paths
- Detects expired and revoked grants

### M3 Audit
- `AuditService.recordCheck()` - record all validation outcomes
- Records both successful and failed validations
- Includes clear reason for denials

### M4 Tasks
- Extended with pre-execution validation
- State machine updated
- Expiry checking implemented

## Test Coverage

All M6 requirements have comprehensive test coverage:

1. **Offline → QUEUED**: Device offline when task created
2. **Expiry → EXPIRED**: Task past deadline transitions correctly
3. **Device revoked before execution**: Validation fails, task marked FAILED
4. **Grant revoked before execution**: Validation fails, task marked FAILED
5. **Grant expired before execution**: Validation fails, task marked FAILED
6. **Cancel while queued**: User can cancel QUEUED tasks
7. **Happy path**: Device trusted + grants valid → executes successfully
8. **Audit trail**: All recheck failures recorded with clear reasons

## Files Modified

- `src/tasks/tasks.service.ts` - Added pre-execution validation
- `src/tasks/tasks.module.ts` - Added ZencontrolModule import
- `src/tasks/tasks.service.spec.ts` - Added GrantsService and AuditService mocks
- `src/tasks/tasks.controller.spec.ts` - Added GrantsService and AuditService mocks
- `src/tasks/tasks-m6.service.spec.ts` - NEW: Comprehensive M6 test suite

## State Machine

```
QUEUED → APPROVED (manual approval for transfer_file)
QUEUED → EXPIRED (past deadline)
QUEUED → CANCELED (user cancels)

APPROVED → EXECUTING (after pre-execution validation)
APPROVED → FAILED (pre-execution validation fails)
APPROVED → CANCELED (user cancels)

EXECUTING → SUCCEEDED (transfer completes)
EXECUTING → FAILED (transfer fails)
```

## Security Considerations

1. **Defense in depth**: Pre-execution validation is a second check after creation-time validation
2. **Audit trail**: All validation failures recorded for security analysis
3. **Least privilege**: Revoked grants immediately prevent execution
4. **Clear failures**: No false successes - validation failures clearly marked as FAILED
5. **Expiry enforcement**: Old tasks don't linger in QUEUED state indefinitely

## Next Steps (Future Enhancements)

- Configurable expiry duration (currently 24h default)
- Automatic expiry background job (currently manual via `checkAndExpireTasks()`)
- More sophisticated presence detection beyond simple heartbeat
- Retry logic for transient failures
- Notification when task expires

## API Examples

### Get tasks with expiry info
```bash
GET /v1/tasks/:taskId
Response:
{
  "taskId": "...",
  "state": "EXPIRED",
  "expiresAt": "2026-11-01T05:28:00.000Z",
  ...
}
```

### Cancel queued task
```bash
POST /v1/tasks/:taskId/cancel
{
  "cancelReason": "User canceled while queued"
}
```

### Task with validation failure
```bash
GET /v1/tasks/:taskId
Response:
{
  "taskId": "...",
  "state": "FAILED",
  "failureReason": "Device revoked before execution",
  ...
}
```
