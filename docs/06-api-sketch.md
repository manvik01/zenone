# ZenOne — API Sketch

**Doc ID:** ZENONE-API-001 · **Version:** 0.0.1 · **Status:** Sketch

Endpoints are from ZENONE-TDD-001 §6. **JSON shapes are illustrative sketches** derived from the TDD data model — not a final contract. All endpoints require authentication (`Authorization: Bearer <session>` — auth mechanism open, ADR-001) and appropriate authorization. Device-originated calls are additionally signed with the device key.

| Group | Method | Path |
|---|---|---|
| Devices | POST | `/v1/devices/pair/start` |
| Devices | POST | `/v1/devices/pair/confirm` |
| Devices | GET | `/v1/devices` |
| Devices | DELETE | `/v1/devices/{device_id}` |
| Tasks | POST | `/v1/tasks` |
| Tasks | GET | `/v1/tasks/{task_id}` |
| Tasks | POST | `/v1/tasks/{task_id}/approve` |
| Tasks | POST | `/v1/tasks/{task_id}/cancel` |
| Files | POST | `/v1/transfers` |
| Files | GET | `/v1/transfers/{transfer_id}` |
| Governance | GET | `/v1/permissions` |
| Governance | POST | `/v1/permissions` |
| Governance | DELETE | `/v1/permissions/{grant_id}` |
| Governance | GET | `/v1/audit` |

## Devices

### POST /v1/devices/pair/start
Starts enrollment; returns an expiring pairing challenge.
```json
// request
{ "platform": "windows", "device_name": "Work Laptop", "public_key": "base64-ed25519...", "capabilities": ["file.search", "file.transfer", "file.open"] }
// 201
{ "pairing_id": "pr_01H...", "challenge": "base64...", "expires_at": "2026-10-31T03:00:00Z", "requires_user_approval": true }
```

### POST /v1/devices/pair/confirm
```json
// request
{ "pairing_id": "pr_01H...", "challenge_signature": "base64...", "approved_by_device_id": "dev_android_1" }
// 200
{ "device_id": "dev_win_1", "trust_status": "trusted" }
```

### GET /v1/devices
```json
{ "devices": [
  { "device_id": "dev_android_1", "platform": "android", "device_name": "Pixel", "capabilities": ["file.receive"], "online": true,  "last_seen": "2026-10-31T02:10:00Z", "trust_status": "trusted" },
  { "device_id": "dev_win_1", "platform": "windows", "device_name": "Work Laptop", "capabilities": ["file.search","file.transfer","file.open"], "online": false, "last_seen": "2026-10-31T01:55:00Z", "trust_status": "trusted" }
] }
```

### DELETE /v1/devices/{device_id}
Revokes trust; subsequent tasks from/to this device are denied.
```json
// 200
{ "device_id": "dev_win_1", "trust_status": "revoked", "revoked_at": "2026-10-31T02:20:00Z" }
```

## Tasks

### POST /v1/tasks
Typed action (from AI Intent Router or direct). Idempotency key required.
```json
// request
{ "idempotency_key": "c0f8...", "requester_device_id": "dev_android_1", "executor_device_id": "dev_win_1",
  "action_type": "file.transfer",
  "payload": { "file_ref": "fs_01H...", "destination_device_id": "dev_android_1" },
  "expires_in_seconds": 3600 }
// 202
{ "task_id": "tsk_01H...", "status": "AWAITING_APPROVAL", "expires_at": "2026-10-31T03:20:00Z" }
```
Supported MVP action types: `file.find`, `file.transfer`, `file.open`, `document.summarize`, `devices.list`, `task.status`.

### GET /v1/tasks/{task_id}
```json
{ "task_id": "tsk_01H...", "action_type": "file.transfer", "status": "SUCCEEDED",
  "requester_device_id": "dev_android_1", "executor_device_id": "dev_win_1",
  "transfer_id": "trf_01H...", "result": { "signed_by": "dev_win_1", "signature": "base64..." },
  "created_at": "2026-10-31T02:20:00Z", "expires_at": "2026-10-31T03:20:00Z" }
```

### POST /v1/tasks/{task_id}/approve
```json
// request
{ "decision": "approve" }
// 200
{ "task_id": "tsk_01H...", "status": "QUEUED" }
```

### POST /v1/tasks/{task_id}/cancel
```json
// 200
{ "task_id": "tsk_01H...", "status": "CANCELLED" }
```

## Files

### POST /v1/transfers
```json
// request
{ "task_id": "tsk_01H...", "source_device_id": "dev_win_1", "destination_device_id": "dev_android_1",
  "file_digest": "sha256:9f86d0...", "byte_count": 482133 }
// 201
{ "transfer_id": "trf_01H...", "status": "PENDING", "upload_url": "https://relay.example/...", "expires_at": "2026-10-31T03:20:00Z" }
```

### GET /v1/transfers/{transfer_id}
```json
{ "transfer_id": "trf_01H...", "task_id": "tsk_01H...", "status": "VERIFIED",
  "file_digest": "sha256:9f86d0...", "byte_count": 482133, "bytes_transferred": 482133 }
```
*Transfer status values (PENDING, IN_PROGRESS, VERIFIED, FAILED, CANCELLED, EXPIRED) are a sketch; the TDD defines a `status` field but not its values.*

## Governance

### GET /v1/permissions
```json
{ "grants": [ { "grant_id": "gr_01H...", "device_id": "dev_win_1", "capability": "file.search",
  "resource_scope": "C:/Users/me/Documents/Reports", "expires_at": null, "revoked_at": null } ] }
```

### POST /v1/permissions
```json
// request
{ "device_id": "dev_win_1", "capability": "file.transfer", "resource_scope": "C:/Users/me/Documents/Reports", "expires_at": "2027-01-31T00:00:00Z" }
// 201
{ "grant_id": "gr_01H..." }
```

### DELETE /v1/permissions/{grant_id}
```json
// 200
{ "grant_id": "gr_01H...", "revoked_at": "2026-10-31T02:30:00Z" }
```

### GET /v1/audit
Query: `?task_id=&device_id=&since=&limit=`
```json
{ "events": [ { "event_id": "ev_01H...", "task_id": "tsk_01H...", "actor_id": "dev_win_1",
  "policy_decision": "allow", "timestamp": "2026-10-31T02:21:00Z", "outcome": "succeeded" } ] }
```

## Errors (sketch)
```json
{ "error": { "code": "PERMISSION_DENIED", "message": "Device has no file.transfer grant for this path.", "task_id": "tsk_01H..." } }
```
Suggested codes: `UNAUTHENTICATED`, `PERMISSION_DENIED`, `DEVICE_REVOKED`, `DEVICE_OFFLINE`, `UNSUPPORTED_ACTION`, `TASK_EXPIRED`, `CHECKSUM_MISMATCH`, `CONFLICT_IDEMPOTENCY`.

Real-time updates (task state, presence) are delivered over WebSocket (TDD §2); channel design is TBD.
