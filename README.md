# ZenOne

Zero-trust device control system with typed actions and human-in-the-loop approval.

## Project Overview

ZenOne enables secure, consent-based automation between your devices. Instead of giving apps unrestricted access, you approve specific actions (like file transfers) between devices you control.

**Status:** M0 Scaffold (Milestone 0) - Foundation complete, feature development in progress

## Architecture

```
zenone/
├── apps/
│   └── zenconnect/          # NestJS backend service
│       ├── src/             # Application source
│       ├── test/            # E2E tests
│       └── package.json     # Dependencies & scripts
├── docs/
│   └── adrs/                # Architecture Decision Records
└── package.json             # Monorepo root
```

### Technology Stack

- **Backend**: NestJS 10.x + TypeScript 5.x (strict mode)
- **Testing**: Jest (TDD workflow)
- **Platform**: Node.js 18+

See [ADR-001](docs/adrs/ADR-001-nestjs-typescript.md) for detailed rationale.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Install dependencies
npm run install:all

# Or manually
cd apps/zenconnect && npm install
```

### Development

```bash
# Start development server (watch mode)
npm run start:dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

### Testing Philosophy

ZenOne follows **strict TDD** (Test-Driven Development):

1. Write failing test first
2. Implement minimum code to pass
3. Refactor while keeping tests green

All features require:
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical flows

## Acceptance Gates

Every PR must address relevant acceptance criteria from `docs/acceptance-gates.md`:

- **Gate 1 (Identity)**: Email/password auth, session management
- **Gate 2 (Devices)**: Device listing, presence, revocation enforcement
- **Gate 3 (Tasks)**: Typed actions, state machine, human confirmation
- **Gate 4 (Transfer)**: Checksum validation, approved folders, byte verification
- **NFRs**: Security, privacy, least privilege

## Architecture Decision Records (ADRs)

Key architectural decisions are documented in `docs/adrs/`:

- [ADR-001: NestJS + TypeScript](docs/adrs/ADR-001-nestjs-typescript.md)
- [ADR-002: Email/Password Auth (Prototype)](docs/adrs/ADR-002-email-password-auth.md)
- [ADR-003: ZenControl Boundary (Open)](docs/adrs/ADR-003-zencontrol-boundary.md)

New ADRs follow the template at `docs/adrs/template.md`.

## Scope & Constraints

ZenOne prototype (M0-M8) focuses on:
- ✅ Android, Linux, Windows clients
- ✅ Email/password authentication
- ✅ `transfer_file` typed action with validation
- ✅ Device management and revocation
- ✅ Human-in-the-loop task approval

**Out of scope** (see `docs/acceptance-gates.md`):
- ❌ iOS/macOS clients
- ❌ Voice commands
- ❌ Third-party integrations
- ❌ Arbitrary shell execution
- ❌ Unrestricted accessibility automation

## Development Roadmap

- **M0**: ✅ NestJS scaffold, TypeScript, testing setup (current)
- **M1-M2**: Email/password auth, session management
- **M3-M4**: Device pairing, presence tracking, revocation
- **M5-M6**: `transfer_file` typed action, state machine
- **M7-M8**: Validation, audit trail, simulated clients

## Contributing

1. Follow TDD: tests before implementation
2. Document architectural decisions in ADRs
3. Ensure all acceptance gates are addressed
4. Run linting and tests before committing

## License

UNLICENSED - Private project

## Repository

https://github.com/manvik01/zenone
