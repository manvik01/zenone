# ZenConnect - Identity & Session Management (M1)

## Overview

ZenConnect M1 implements a secure identity system with email/password authentication, JWT-based session management, email verification, and password recovery.

## Features

### Gate 1: Identity (MVP-01/FR-01) ✓

- **Email Registration**: Users register with email and password
- **Email Verification**: Email verification tokens with 24-hour expiry
- **Authentication**: Secure login with bcrypt password hashing
- **JWT Sessions**: Real JWT tokens (access + refresh) for authentication
- **Multi-Client Support**: Same account can be used from multiple devices simultaneously
- **Password Recovery**: Password reset flow with 1-hour expiry tokens
- **Session Management**: Session validation, refresh, and logout

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
- **Prototype**: In-memory storage for users, sessions, and verification tokens
- **Production Ready**: Designed for later migration to PostgreSQL/Redis
  - User data → PostgreSQL
  - Sessions → Redis with TTL
  - Verification tokens → Redis with TTL

### Technology Stack
- NestJS 10.x
- JWT (jsonwebtoken via @nestjs/jwt)
- bcrypt for password hashing
- TypeScript with strict type checking
- Jest for testing (72 test cases)

## Testing

Run the test suite:

```bash
npm test                  # Run all tests
npm test:watch           # Watch mode
npm test:cov             # With coverage
```

**Test Coverage:**
- ✓ 17 tests for IdentityService
- ✓ 15 tests for SessionService
- ✓ 20 tests for VerificationService
- ✓ 20 integration tests for IdentityController

All tests follow TDD principles - written before implementation.

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

## Next Steps (M2)

- Device management module
- Device registration and capabilities
- Device revocation
- Presence tracking

## Scope Lock

**Excluded features (per acceptance gates):**
- OAuth/Social login
- iOS/macOS native clients (M1 scope)
- 3P integrations
- Enterprise features

## License

ISC
