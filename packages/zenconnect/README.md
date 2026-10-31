# ZenConnect - Identity, Device & Task Management (M1 + M2 + M4)

## Overview

ZenConnect implements secure identity management, device pairing and presence, and task state machine for ZenOne. Features include email/password authentication, JWT sessions, device pairing with trust status, and typed task orchestration with human approval flow.

## Features

### Gate 1: Identity (MVP-01/FR-01) ✓

- **Email Registration**: Users register with email and password
- **Email Verification**: Email verification tokens with 24-hour expiry
- **Authentication**: Secure login with bcrypt password hashing
- **JWT Sessions**: Real JWT tokens (access + refresh) for authentication
- **Multi-Client Support**: Same account can be used from multiple devices simultaneously
- **Password Recovery**: Password reset flow with 1-hour expiry tokens
- **Session Management**: Session validation, refresh, and logout

### Gate 2: Device Management (MVP-02) ✓

- **Device Pairing**: Two-step pairing flow (start → confirm with 6-digit code, 5min expiry)
- **Device Listing**: View all paired devices with metadata and real-time status
- **Presence Tracking**: Accurate online/offline status (60s timeout, no false positives)
- **Device Revocation**: Immediate revocation with revokedAt timestamp
- **Task Execution Control**: Revoked devices CANNOT execute tasks (enforced before task creation)
- **Capabilities Registry**: Track per-device capabilities (file_transfer, execute_tasks, etc.)
- **Owner Authorization**: Only device owners can view, update, or revoke their devices

### Gate 3: Task State Machine (M4) ✓

- **Typed Actions**: Enum-based action types (transfer_file, summarize, list_devices, task_status)
- **Durable State Machine**: QUEUED → APPROVED → EXECUTING → SUCCEEDED/FAILED transitions
- **Human Approval Required**: transfer_file tasks require explicit user approval
- **Auto-Approval**: Non-transfer actions (list_devices, task_status, summarize) auto-approved
- **Device Validation**: Both source and target devices validated (ownership + trust status)
- **Revocation Enforcement**: Revoked devices rejected at task creation (Gate 2 integration)
- **Task Expiry**: Tasks expire after 24 hours if not executed
- **State Transition Guards**: Invalid transitions rejected with clear error messages
- **Task Filtering**: List tasks by state, actionType, or deviceId
- **M4 Scope**: State machine only - no transfer execution (M5 will add EXECUTING → SUCCEEDED/FAILED)


## API Endpoints

### Authentication

#### `POST /v1/auth/register`
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "accountStatus": "ACTIVE",
  "emailVerified": false,
  "createdAt": "2026-10-31T00:00:00.000Z",
  "verificationToken": "ev_token"
}
```

#### `POST /v1/auth/verify-email`
Verify email address with token.

**Request:**
```json
{
  "token": "ev_token_from_registration"
}
```

#### `POST /v1/auth/login`
Authenticate and create a session.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token",
  "userId": "uuid",
  "email": "user@example.com",
  "expiresIn": 900
}
```

#### `POST /v1/auth/refresh`
Refresh session with refresh token.

**Request:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

#### `POST /v1/auth/logout`
Revoke current session (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

#### `GET /v1/auth/me`
Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

### Password Recovery

#### `POST /v1/auth/request-password-reset`
Request password reset token.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Note:** Always returns success (security - doesn't reveal if email exists)

#### `POST /v1/auth/reset-password`
Reset password with token.

**Request:**
```json
{
  "token": "pr_token_from_email",
  "newPassword": "NewSecurePass456!"
}
```

### Device Management (M2)

#### `POST /v1/devices/pair/start`
Initiate device pairing (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "deviceName": "My Android Phone",
  "platform": "ANDROID",
  "publicKey": "base64-encoded-public-key",
  "capabilities": ["file_transfer", "execute_tasks"]
}
```

**Response:**
```json
{
  "deviceId": "device-uuid",
  "pairingCode": "123456",
  "expiresAt": "2026-10-31T00:05:00.000Z"
}
```

**Note:** Pairing code expires in 5 minutes. Present it to the user for confirmation.

#### `POST /v1/devices/pair/confirm/:deviceId`
Complete device pairing with code (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "pairingCode": "123456"
}
```

**Response:**
```json
{
  "deviceId": "device-uuid",
  "userId": "user-uuid",
  "platform": "ANDROID",
  "deviceName": "My Android Phone",
  "capabilities": ["file_transfer", "execute_tasks"],
  "lastSeen": "2026-10-31T00:00:00.000Z",
  "trustStatus": "TRUSTED",
  "createdAt": "2026-10-31T00:00:00.000Z",
  "updatedAt": "2026-10-31T00:00:00.000Z"
}
```

#### `GET /v1/devices`
List all devices for authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "deviceId": "device-uuid",
    "platform": "ANDROID",
    "deviceName": "My Android Phone",
    "capabilities": ["file_transfer", "execute_tasks"],
    "lastSeen": "2026-10-31T00:00:00.000Z",
    "trustStatus": "TRUSTED",
    "isOnline": true,
    "createdAt": "2026-10-31T00:00:00.000Z"
  }
]
```

**Fields:**
- `isOnline`: Device is online if `lastSeen` is within 60 seconds and not revoked
- `trustStatus`: `PENDING`, `TRUSTED`, or `REVOKED`

#### `GET /v1/devices/:deviceId`
Get details for a specific device (requires authentication, owner only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** Same as device object in list response.

#### `POST /v1/devices/:deviceId/heartbeat`
Update device presence (requires authentication, owner only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "deviceId": "device-uuid",
  "lastSeen": "2026-10-31T00:00:00.000Z",
  "isOnline": true
}
```

**Usage:** Devices should send heartbeat every 30 seconds to maintain online status.

#### `DELETE /v1/devices/:deviceId`
Revoke a device (requires authentication, owner only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "deviceId": "device-uuid",
  "trustStatus": "REVOKED",
  "revokedAt": "2026-10-31T00:00:00.000Z"
}
```

**Critical:** Revoked devices CANNOT execute tasks. Any attempt to create tasks with a revoked device will fail with a 400 error.

### Task Management (M4)

#### `POST /v1/tasks`
Create a new task (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "sourceDeviceId": "device-uuid-source",
  "targetDeviceId": "device-uuid-target",
  "actionType": "transfer_file",
  "actionPayload": {
    "filePath": "/path/to/file.txt",
    "targetPath": "/path/to/destination.txt"
  }
}
```

**Response:**
```json
{
  "taskId": "task-uuid",
  "userId": "user-uuid",
  "sourceDeviceId": "device-uuid-source",
  "targetDeviceId": "device-uuid-target",
  "actionType": "transfer_file",
  "actionPayload": { "filePath": "/path/to/file.txt" },
  "state": "QUEUED",
  "createdAt": "2026-10-31T00:00:00.000Z",
  "updatedAt": "2026-10-31T00:00:00.000Z",
  "expiresAt": "2026-11-01T00:00:00.000Z"
}
```

**Action Types:**
- `transfer_file`: File transfer (requires approval)
- `list_devices`: List devices (auto-approved)
- `task_status`: Query task state (auto-approved)
- `summarize`: Summarize content (auto-approved, stub)

**State Machine:**
- `transfer_file` tasks start in `QUEUED` state (require approval)
- Other action types are auto-approved (start in `APPROVED` state)
- Tasks expire after 24 hours if not executed

**Validation:**
- Both source and target devices must be TRUSTED
- Revoked devices are rejected with 400 error
- Only device owner can create tasks

#### `GET /v1/tasks`
List user's tasks (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `state`: Filter by state (QUEUED, APPROVED, CANCELED, EXPIRED, etc.)
- `actionType`: Filter by action type (transfer_file, list_devices, etc.)
- `deviceId`: Filter by device (source or target)

**Response:**
```json
[
  {
    "taskId": "task-uuid",
    "userId": "user-uuid",
    "sourceDeviceId": "device-uuid-source",
    "targetDeviceId": "device-uuid-target",
    "actionType": "transfer_file",
    "actionPayload": {},
    "state": "QUEUED",
    "createdAt": "2026-10-31T00:00:00.000Z",
    "updatedAt": "2026-10-31T00:00:00.000Z",
    "expiresAt": "2026-11-01T00:00:00.000Z"
  }
]
```

#### `GET /v1/tasks/:taskId`
Get task details (requires authentication, owner only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** Same as task object in list response, with approval/cancellation metadata when applicable.

#### `GET /v1/tasks/:taskId/status`
Query task state (requires authentication, owner only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "taskId": "task-uuid",
  "state": "APPROVED",
  "updatedAt": "2026-10-31T00:00:00.000Z"
}
```

#### `POST /v1/tasks/:taskId/approve`
Approve a transfer_file task (requires authentication, owner only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "approvedBy": "user-uuid"
}
```

**Response:**
```json
{
  "taskId": "task-uuid",
  "state": "APPROVED",
  "approvedAt": "2026-10-31T00:00:00.000Z",
  "approvedBy": "user-uuid",
  "updatedAt": "2026-10-31T00:00:00.000Z"
}
```

**Valid Transitions:**
- QUEUED → APPROVED
- Invalid transitions return 400 error

#### `POST /v1/tasks/:taskId/cancel`
Cancel a task (requires authentication, owner only).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "cancelReason": "User canceled the operation"
}
```

**Response:**
```json
{
  "taskId": "task-uuid",
  "state": "CANCELED",
  "canceledAt": "2026-10-31T00:00:00.000Z",
  "cancelReason": "User canceled the operation",
  "updatedAt": "2026-10-31T00:00:00.000Z"
}
```

**Valid Transitions:**
- QUEUED → CANCELED
- APPROVED → CANCELED

**Note:** M4 implements only the state machine. Actual task execution (EXECUTING → SUCCEEDED/FAILED) will be added in M5.

## Security Features

### NFRs Implemented

#### ✓ Least Privilege Principle
- Sessions are scoped to individual users
- Token validation ensures user existence
- Revoked sessions cannot be used

#### ✓ Password Security
- Passwords hashed with bcrypt (salt rounds: 10)
- Minimum password length: 8 characters
- No plaintext passwords stored

#### ✓ Session Security
- JWT tokens with HMAC-SHA256 signing
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Session revocation support
- Multiple concurrent sessions per user

#### ✓ Token Expiry
- Email verification tokens: 24 hours
- Password reset tokens: 1 hour
- Tokens marked as used after consumption
- Pairing codes: 5 minutes (M2)

#### ✓ Device Security (M2)
- All device endpoints require JWT authentication
- Device ownership enforced: users can only access their own devices
- Pairing codes expire in 5 minutes
- Trust status validation: PENDING → TRUSTED → (optional) REVOKED
- Immediate revocation enforcement: revoked devices blocked from task execution
- Presence timeout: 60 seconds (prevents false online status)
- Device capabilities registry for future task routing

#### ✓ Encrypted Transport
**Production Requirements:**
- TLS 1.2+ required for all API endpoints
- HTTPS only - no plain HTTP
- Set `NODE_ENV=production` and configure reverse proxy (nginx/Caddy) with TLS certificates

**Development:**
- Currently HTTP for local development
- JWT secret configurable via `JWT_SECRET` environment variable
- Default dev secret: `zenone-dev-secret-change-in-production`

**TLS Configuration Example (nginx):**
```nginx
server {
    listen 443 ssl http2;
    server_name api.zenone.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Architecture

### Storage
- **Prototype**: In-memory storage for users, sessions, verification tokens, and devices
- **Production Ready**: Designed for later migration to PostgreSQL/Redis
  - User data → PostgreSQL
  - Sessions → Redis with TTL
  - Verification tokens → Redis with TTL
  - Devices → PostgreSQL with indexes on userId and trustStatus

### Technology Stack
- NestJS 10.x
- JWT (jsonwebtoken via @nestjs/jwt)
- bcrypt for password hashing
- TypeScript with strict type checking
- Jest for testing (119 test cases)

## Testing

Run the test suite:

```bash
npm test                  # Run all tests (174 passing)
npm test:watch           # Watch mode
npm test:cov             # With coverage
npm run typecheck        # TypeScript type checking
```

**Test Coverage (M1 + M2 + M4):**
- ✓ 17 tests for IdentityService (registration, validation, verification)
- ✓ 15 tests for SessionService (JWT sessions, refresh, revoke)
- ✓ 20 tests for VerificationService (email verification, password reset)
- ✓ 20 tests for IdentityController (integration tests)
- ✓ 29 tests for DevicesService (pairing, listing, presence, revocation)
- ✓ 15 tests for DevicesController (integration tests with JWT auth)
- ✓ 13 tests for TaskValidationService (revoked device enforcement)
- ✓ 32 tests for TasksService (state machine, transitions, expiry, filtering)
- ✓ 23 tests for TasksController (task CRUD, approval, cancellation with JWT auth)

All tests follow strict TDD - written before implementation.

## Development

### Environment Variables

```bash
# Required for production
JWT_SECRET=your-secret-key-min-32-characters

# Optional
NODE_ENV=production
PORT=3000
```

### Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm start
```

## Multi-Client Support

The system supports multiple simultaneous sessions:
- Each login creates a new session
- Sessions are independent
- Each device gets unique JWT tokens
- Logout only revokes the current session
- All user sessions can be revoked if needed

Example: User logs in from laptop and phone simultaneously - both devices get valid, independent sessions.

## Implementation Status

- ✅ **M1 (Identity)**: Complete - JWT auth, email verification, password recovery
- ✅ **M2 (Device Management)**: Complete - Pairing, presence, revocation, task validation
- ✅ **M4 (Task State Machine)**: Complete - Typed actions, approval flow, state transitions, expiry (M5 will add transfer execution)
- 🔜 **M3 (Grants)**: File-level permissions for transfers
- 🔜 **M5 (Transfer Execution)**: File transfer coordination with checksums, EXECUTING → SUCCEEDED/FAILED states
- 🔜 **M6-M8**: AI intent routing, context sync, full integration

## Scope Lock

**Excluded features (per acceptance gates):**
- OAuth/Social login
- iOS/macOS native clients (M1 scope)
- 3P integrations
- Enterprise features

## License

ISC
