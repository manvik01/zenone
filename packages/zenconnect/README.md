# ZenConnect

> Cloud orchestration layer for ZenOne cross-device AI assistant - Prototype v0.0.2

ZenConnect provides device registration, task routing, encrypted relay, and AI intent orchestration for the ZenOne ecosystem.

## Status

**Prototype scaffold** — Core modules and endpoints stubbed with in-memory data stores. Ready for local development and iteration.

## Architecture

ZenConnect implements the backend stack decision (ADR-002): **TypeScript / NestJS**.

### Modules

| Module | Responsibility | Endpoints |
|---|---|---|
| **Gateway** | Health checks, API root | `GET /health`, `GET /` |
| **Identity** | User registration, authentication (email+password prototype) | `POST /v1/auth/register`, `POST /v1/auth/login` |
| **Devices** | Device pairing, trust management | `POST /v1/devices/pair/start`, `POST /v1/devices/pair/confirm`, `GET /v1/devices`, `DELETE /v1/devices/:id` |
| **Tasks** | Task orchestration, lifecycle management | `POST /v1/tasks`, `GET /v1/tasks/:id`, `POST /v1/tasks/:id/approve`, `POST /v1/tasks/:id/cancel` |
| **Intent** | AI intent parsing (stub — no live LLM) | `POST /v1/intent/parse` |
| **Transfers** | File transfer coordination (stub) | `POST /v1/transfers`, `GET /v1/transfers/:id`, `POST /v1/transfers/:id/verify` |

### Data Model

All entities stored in-memory for rapid prototyping:

- **User**: email, passwordHash (bcrypt), accountStatus
- **Device**: platform, deviceName, publicKey, capabilities, trustStatus
- **Task**: requesterDevice, executorDevice, actionType, payload, status, idempotencyKey
- **Transfer**: taskId, sourceDevice, destinationDevice, fileDigest, byteCount, status

See TDD entity definitions in `/workspace/docs/03-tdd.md` §4.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- No database required (in-memory stores)

### Installation

```bash
cd packages/zenconnect
npm install
```

### Configuration

Copy `.env.example` to `.env` and adjust if needed:

```bash
cp .env.example .env
```

Default configuration runs on `http://localhost:3000`.

### Running the Prototype

**Development mode** (with auto-reload):

```bash
npm run start:dev
```

**Production build**:

```bash
npm run build
npm start
```

**Type checking**:

```bash
npm run typecheck
```

### Verify Setup

Once running, check the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-10-31T01:38:00.000Z",
  "service": "zenconnect",
  "version": "0.0.2"
}
```

## Example API Flows

### 1. Register a User

```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

### 3. Pair a Device (Start)

```bash
curl -X POST http://localhost:3000/v1/devices/pair/start \
  -H "Content-Type: application/json" \
  -H "x-user-id: <userId-from-login>" \
  -d '{
    "deviceName": "My Android Phone",
    "platform": "ANDROID",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
    "capabilities": ["file_read", "file_write", "file_transfer"]
  }'
```

Returns: `{ "deviceId": "...", "pairingCode": "123456", "expiresAt": "..." }`

### 4. Pair a Device (Confirm)

```bash
curl -X POST http://localhost:3000/v1/devices/pair/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "<deviceId-from-start>",
    "pairingCode": "123456"
  }'
```

### 5. Create a Task

```bash
curl -X POST http://localhost:3000/v1/tasks \
  -H "Content-Type: application/json" \
  -H "x-device-id: <requesterDeviceId>" \
  -d '{
    "executorDeviceId": "<targetDeviceId>",
    "actionType": "TRANSFER_FILE",
    "payload": {
      "fileName": "report.pdf",
      "sourcePath": "/documents/report.pdf"
    }
  }'
```

### 6. Parse Intent (Stub)

```bash
curl -X POST http://localhost:3000/v1/intent/parse \
  -H "Content-Type: application/json" \
  -d '{
    "userInput": "Send report.pdf from my laptop"
  }'
```

## Implementation Notes

### Authentication

- **Prototype only**: Email + password with bcrypt hashing (ADR-001)
- No JWT implementation yet — user auth is stubbed with headers (`x-user-id`, `x-device-id`)
- **Production upgrade path**: Replace with OIDC + passkeys behind the identity service interface

### ZenControl Boundary

- Currently implemented as logical separation within services (not a separate module yet)
- Decision deferred per ADR-003 — boundaries clearly defined for future extraction

### Data Persistence

- **Current**: In-memory maps (data lost on restart)
- **Next step**: Add TypeORM or Prisma with PostgreSQL
- **Migration path**: Replace service storage with repository pattern; DTOs remain unchanged

### AI Intent Router

- **Current**: Simple pattern matching stub
- **Next step**: Integrate OpenAI, Anthropic, or local LLM via provider-agnostic adapter
- Intent parsing interface is stable for swapping implementations

## What's Next

According to the prototype plan (`/workspace/docs/05-prototype-plan.md`):

1. ✅ Scaffold NestJS backend with core modules
2. 🔜 Add real authentication (JWT tokens, session management)
3. 🔜 Implement permission checking (folder grants, audit events)
4. 🔜 Build Android and/or Windows client prototypes
5. 🔜 Add database persistence (PostgreSQL + Redis)
6. 🔜 Integrate live AI model for intent parsing
7. 🔜 Implement encrypted file relay

## Documentation

See the full documentation pack in `/workspace/docs/`:

- [00-overview.md](../../docs/00-overview.md) — Vision and architecture
- [01-prd.md](../../docs/01-prd.md) — Product requirements
- [02-mvp.md](../../docs/02-mvp.md) — MVP scope
- [03-tdd.md](../../docs/03-tdd.md) — Technical design document
- [04-decisions.md](../../docs/04-decisions.md) — Architecture decisions (updated with locked choices)
- [05-prototype-plan.md](../../docs/05-prototype-plan.md) — Prototype scope and decision status
- [06-api-sketch.md](../../docs/06-api-sketch.md) — API examples
- [07-security.md](../../docs/07-security.md) — Security model

## License

ISC
