# ZenConnect - Identity & Device Management (M1 + M2)

## Overview

ZenConnect implements secure identity and device management for ZenOne, with email/password authentication, JWT-based session management, device pairing, presence tracking, and task validation.

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
npm test                  # Run all tests (119 passing)
npm test:watch           # Watch mode
npm test:cov             # With coverage
npm run typecheck        # TypeScript type checking
```

**Test Coverage (M1 + M2):**
- ✓ 17 tests for IdentityService (registration, validation, verification)
- ✓ 15 tests for SessionService (JWT sessions, refresh, revoke)
- ✓ 20 tests for VerificationService (email verification, password reset)
- ✓ 20 tests for IdentityController (integration tests)
- ✓ 29 tests for DevicesService (pairing, listing, presence, revocation)
- ✓ 15 tests for DevicesController (integration tests with JWT auth)
- ✓ 13 tests for TaskValidationService (revoked device enforcement)

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
- 🔜 **M3-M4**: Task orchestration, typed actions, approval flow
- 🔜 **M5**: File transfer coordination with checksums
- 🔜 **M6-M8**: AI intent routing, context sync, full integration

## Scope Lock

**Excluded features (per acceptance gates):**
- OAuth/Social login
- iOS/macOS native clients (M1 scope)
- 3P integrations
- Enterprise features

## License

ISC
