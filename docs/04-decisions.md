# ZenOne — Architecture Decision Records (Open)

**Doc ID:** ZENONE-ADR-001 · **Version:** 0.0.1 · **Status:** Open — no decision locked

User direction: **defer auth and backend choices; document options.** Leans below are suggestions only.

| ADR | Topic | Status |
|---|---|---|
| ADR-001 | Authentication model | **Open** |
| ADR-002 | ZenConnect backend stack | **Open** |
| ADR-003 | Future monorepo layout | Proposed |
| ADR-004 | Docs-first, code later | **Accepted** |
| ADR-005 | MVP platforms: Android + Windows; iOS/macOS designed in | **Accepted** (from source) |

---

## ADR-001 — Authentication model

**Context.** PRD FR-01 requires email-based registration and authentication; MVP-01 adds verification, recovery, device enrollment and session management. The TDD proposes OIDC-compatible auth with passkeys and short-lived sessions. Device trust is separate: per-device asymmetric keys + pairing challenge (independent of the account auth choice).

### Options

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A. Email OTP / magic link** | User enters email, receives a one-time code/link | Directly satisfies FR-01; no passwords; simple UX; quick to build | Depends on email deliverability; phishable codes; recovery = email access; weaker than passkeys |
| **B. OIDC + passkeys** (TDD proposal) | Standards-based IdP (hosted or self-run) with WebAuthn passkeys, short-lived sessions | Strongest; phishing-resistant; matches TDD; enterprise-ready later | More integration work on Android/.NET; vendor/IdP choice needed; passkey recovery flows need design |
| **C. Email + password (prototype only)** | Classic credentials, hashed | Fastest to prototype; no external deps | Weakest security; would need replacing; not aligned with TDD |

**Possible hybrid:** email OTP for verification/recovery + passkeys as primary sign-in, delivered via an OIDC provider.

**Lean (not locked):** B for the product (aligns with TDD and ZenControl). For a first local prototype, A (or a stub of it) behind an auth interface keeps the swap cheap. C only for a throwaway demo.

**Decision needed from user:** A / B / hybrid / C-for-prototype; hosted IdP vs self-run.

---

## ADR-002 — ZenConnect backend stack

**Context.** ZenConnect needs REST + WebSocket, durable queue, Redis presence, PostgreSQL, encrypted object storage, OpenTelemetry, provider-agnostic AI adapter. TDD proposes TypeScript/NestJS.

| Option | Pros | Cons |
|---|---|---|
| **NestJS / TypeScript** (TDD proposal) | Matches TDD; strong WebSocket + DI + modules (maps to services); shared types with a web console; large ecosystem | Node CPU limits for heavy work; runtime type safety needs validation libs |
| **FastAPI / Python** | Fastest AI iteration; best AI/LLM library ecosystem; Pydantic typed schemas | WebSocket/concurrency at scale less mature; GIL; packaging/deploy weight |
| **Go** | High concurrency for presence/relay; single static binary; low resource use; strong for long-lived connections | More boilerplate; smaller AI ecosystem; slower product iteration |

**Lean (not locked):** NestJS/TS for orchestration (TDD alignment, typed contracts across services). Keep the AI adapter behind an interface so a Python sidecar remains possible. Go is the fallback if relay/presence load becomes the bottleneck.

**Decision needed from user:** stack choice; single service vs. split (e.g., relay separately).

---

## ADR-003 — Future monorepo layout (proposed)

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

## ADR-004 — Docs first, code later (Accepted)

Documentation pack is written before any code; prototype starts once ADR-001/002 and the checklist in [05-prototype-plan.md](05-prototype-plan.md) are resolved. Target home: private GitHub repo `zenone`.

## ADR-005 — Platforms (Accepted, from source)

Android + Windows for MVP; iOS/macOS designed into the architecture from the outset and shipped after the MVP exit decision.
