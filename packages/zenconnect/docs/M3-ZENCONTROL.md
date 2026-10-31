# ZenControl Module - M3 Permissions & Audit

## Overview

ZenControl provides permission management, capability checks, and audit logging for ZenOne. This module is the authorization layer that M5 transfer operations will use to validate every file access.

## Key Features

### 1. Permission Grants
- **Explicit grants**: Users must explicitly grant device access to files or folders
- **Granular capabilities**: READ, WRITE, TRANSFER, LIST
- **Time-based expiry**: Grants can have expiration dates
- **Instant revocation**: Grants can be revoked immediately

### 2. Capability Checks
- **Device validation**: Checks if device is trusted (not revoked)
- **Path validation**: Validates requested path matches granted resource
- **Capability matching**: Ensures requested capability is included in grant
- **Path traversal protection**: Normalizes paths to prevent ".." attacks

### 3. Audit Trail
- **Every check recorded**: All permission checks logged with timestamp
- **Queryable**: Filter by user, device, date range
- **Proof of authorization**: Shows auth-before-action for compliance

## API Endpoints

### Create Grant
```
POST /v1/zencontrol/grants
Authorization: Bearer <JWT>

{
  "deviceId": "device-123",
  "resourceType": "folder_path",
  "resourcePath": "/home/user/documents",
  "capabilities": ["read", "transfer"],
  "expiresAt": "2026-12-31T23:59:59Z" // optional
}
```

### List Grants
```
GET /v1/zencontrol/grants
Authorization: Bearer <JWT>
```

### Revoke Grant
```
DELETE /v1/zencontrol/grants/{grantId}
```

### Check Grant (Internal)
```
POST /v1/zencontrol/check
Authorization: Bearer <JWT>

{
  "deviceId": "device-123",
  "resourceType": "file_path",
  "resourcePath": "/home/user/documents/file.txt",
  "capability": "transfer"
}

Response:
{
  "granted": true
}
// or
{
  "granted": false,
  "reason": "No matching grant found"
}
```

### Query Audit Log
```
GET /v1/zencontrol/audit?userId=user-123&from=2026-10-01T00:00:00Z&to=2026-10-31T23:59:59Z&limit=100
```

### Get Audit Stats
```
GET /v1/zencontrol/audit/stats

Response:
{
  "total": 1000,
  "granted": 850,
  "denied": 150
}
```

## Integration with M5 Transfer

### How M5 Will Use ZenControl

```typescript
// In M5 TransferService, before any file operation:

async transferFile(userId: string, deviceId: string, filePath: string) {
  // MUST check grant before transfer
  const grantCheck = await this.grantsService.checkGrant(
    userId,
    deviceId,
    ResourceType.FILE_PATH,
    filePath,
    Capability.TRANSFER
  );

  if (!grantCheck.granted) {
    throw new UnauthorizedException(
      `Transfer denied: ${grantCheck.reason}`
    );
  }

  // Grant check passed - proceed with transfer
  return await this.performTransfer(filePath);
}
```

## Folder ACL Rules

### Exact Match (Files)
- Grant: `/home/user/file.txt` with `FILE_PATH`
- Allows: `/home/user/file.txt`
- Denies: `/home/user/other.txt`

### Prefix Match (Folders)
- Grant: `/home/user/documents` with `FOLDER_PATH`
- Allows: 
  - `/home/user/documents/file.txt`
  - `/home/user/documents/subfolder/file.txt`
- Denies:
  - `/home/user/other/file.txt`
  - `/home/user/documents` (folder itself, use LIST capability for folder operations)

### Path Traversal Protection
- Grant: `/home/user/documents` with `FOLDER_PATH`
- Request: `/home/user/documents/../secrets/file.txt`
- Result: **DENIED** (path normalized to `/home/user/secrets/file.txt`)

## Security Guarantees

1. **Least Privilege**: No grant = no access
2. **Defense in Depth**: Device must be trusted AND grant must exist
3. **Audit Trail**: Every check recorded, even denials
4. **No Auto-Trust**: Every file operation requires explicit grant
5. **Revocation**: Both device revocation and grant revocation respected
6. **Expiry**: Time-based grants automatically expire

## Storage

- **Current**: In-memory (Map-based)
- **Production**: Designed for time-series database (audit log) + relational DB (grants)
- **Performance**: Fast in-memory lookups suitable for per-file checks

## Testing

```bash
npm test -- --testPathPatterns=zencontrol
```

### Test Coverage
- ✅ Grant creation with/without expiry
- ✅ Grant revocation
- ✅ Exact path matching
- ✅ Folder path matching
- ✅ Nested folder access
- ✅ Path traversal protection
- ✅ Capability validation
- ✅ Device trust validation
- ✅ Grant expiry
- ✅ Audit recording (granted/denied)
- ✅ Audit querying

## Scope Lock Verification

**What's Included:**
- ✅ File and folder permission grants
- ✅ Capability-based access control
- ✅ Audit trail
- ✅ Integration with M1 (Identity) and M2 (Devices)

**What's Excluded:**
- ❌ Shell execution permissions
- ❌ Accessibility automation grants
- ❌ Booking/payment permissions
- ❌ Auto-trust mechanisms
- ❌ AI/LLM features
- ❌ Any "smart" path matching beyond exact/prefix

## Next Steps (M4/M5)

1. M4 Tasks module will use `GrantsService.checkGrant()` to validate permissions before task execution
2. M5 Transfer module MUST call `checkGrant()` for every file path before transfer
3. No exceptions - folder ACL enforcement is mandatory
