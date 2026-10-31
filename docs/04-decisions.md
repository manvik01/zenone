# ZenOne — Architecture Decision Records

**Doc ID:** ZENONE-ADR-001 · **Version:** 0.0.2 · **Status:** Decisions locked for prototype

| ADR | Topic | Status |
|---|---|---|
| ADR-001 | Authentication model | **Accepted** (prototype only) |
| ADR-002 | ZenConnect backend stack | **Accepted** |
| ADR-003 | ZenControl boundary | **Open** (deferred) |
| ADR-004 | Future monorepo layout | Proposed |
| ADR-005 | Docs-first, code later | **Accepted** |
| ADR-006 | MVP platforms: Android + Windows; iOS/macOS designed in | **Accepted** (from source) |

---

## ADR-001 — Authentication model (Prototype)

**Status:** **ACCEPTED** for prototype only — 2026-10-31

**Context.** PRD FR-01 requires email-based registration and authentication; MVP-01 adds verification, recovery, device enrollment and session management. The TDD proposes OIDC-compatible auth with passkeys and short-lived sessions. Device trust is separate: per-device asymmetric keys + pairing challenge (independent of the account auth choice).

### Decision

**Prototype authentication:** Email + password with bcrypt hashing (Option C).

**Rationale:**
- Fastest path to a working prototype with zero external dependencies
- Sufficient for demonstrating the cross-device task execution flow
- Auth interface design allows future upgrade to OIDC/passkeys without architectural rework

**Product authentication remains upgradeable:** This decision applies to the prototype only. The production authentication model (OIDC + passkeys per TDD, or email OTP) is explicitly NOT locked and should be revisited before any public deployment.

**Implementation notes:**
- Use bcrypt or Argon2 for password hashing
- Implement behind an auth interface/service boundary
- JWT tokens for session management
- Device trust remains independent: per-device asymmetric keys + pairing challenge

---

## ADR-002 — ZenConnect backend stack

**Status:** **ACCEPTED** — 2026-10-31

**Context.** ZenConnect needs REST + WebSocket, durable queue, Redis presence, PostgreSQL, encrypted object storage, OpenTelemetry, provider-agnostic AI adapter. TDD proposes TypeScript/NestJS.

### Decision

**Backend stack:** TypeScript with NestJS framework.

**Rationale:**
- **TDD alignment:** Matches the reference architecture proposed in ZENONE-TDD-001
- **Module architecture:** NestJS dependency injection and module system maps cleanly to ZenOne's service boundaries (gateway, identity, devices, tasks, intent, transfers)
- **WebSocket support:** Built-in WebSocket support for real-time device presence and task routing
- **Type safety:** Shared TypeScript types across services and potential web console
- **Ecosystem:** Mature libraries for PostgreSQL, Redis, message queues, and OpenTelemetry
- **Flexibility:** AI adapter interface allows Python sidecar for LLM-heavy operations if needed

**Implementation approach:**
- Start with a monolithic NestJS service containing all ZenConnect modules
- AI intent router implemented as provider-agnostic adapter interface
- Future option: split high-load services (relay, presence) to Go if performance requires

---

## ADR-003 — ZenControl boundary

**Status:** **OPEN** (deferred) — 2026-10-31

**Context.** ZenControl is responsible for device identity, user consent, permission grants, policy decisions, action approval, audit records, and revocation enforcement. The question is whether ZenControl should be:
- **Option A:** A module within the ZenConnect service (in-process)
- **Option B:** A separate microservice

**Decision:** **Deferred until prototype coding progresses.**

**Rationale:**
- Starting with ZenControl as a module inside ZenConnect minimizes operational complexity for the prototype
- The interface between ZenConnect and ZenControl can be designed with clear boundaries regardless of deployment model
- Real-world usage patterns during prototype development will inform the scaling/isolation requirements
- Both options remain viable; the choice can be made based on observed needs rather than speculation

**Next steps:**
- Implement ZenControl as a well-bounded NestJS module within ZenConnect
- Define clear service interfaces (authorization checks, audit logging, policy evaluation)
- Revisit this decision once prototype demonstrates actual load patterns and security isolation requirements

---

## ADR-004 — Future monorepo layout (proposed)

```
zenone/
├── README.md
├── CHANGELOG.md
├── docs/                    # this pack
│   └── adr/                 # ADRs split out once decided
├── apps/
│   ├── android/             # Kotlin / Jetpack Compose client
│   ├── windows-agent/       # .NET 8+ tray agent + executor
│   ├── ios/                 # (future) Swift
│   └── macos-agent/         # (future) Swift
├── services/
│   └── zenconnect/          # gateway, registry, orchestrator, relay, sync, intent router
│       └── zencontrol/      # or separate service: identity/permissions/policy/audit
├── packages/
│   ├── protocol/            # shared API schemas (OpenAPI/JSON Schema), task/action types
│   └── action-catalog/      # allowlisted typed actions + capability manifest schema
├── infra/                   # docker-compose for Postgres, Redis, queue, object storage
└── .github/workflows/       # CI
```

Open points: ZenControl in-process module vs. separate service; schema source of truth (OpenAPI vs. JSON Schema).

---

## ADR-005 — Docs first, code later

**Status:** **ACCEPTED** — 2026-10-31

Documentation pack completed before code implementation. Prototype scaffolding begins after critical architectural decisions (ADR-001, ADR-002) are locked. Target repository: GitHub `manvik01/zenone`.

## ADR-006 — MVP platforms

**Status:** **ACCEPTED** (from source PRD/TDD)

**Decision:** Android + Windows for MVP launch. iOS and macOS are designed into the architecture from the outset and will be implemented after MVP validation.

**Rationale:** Cross-platform demonstration (mobile + desktop, different ecosystems) while maintaining focused initial scope.
