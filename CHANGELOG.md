# Changelog

## v0.0.3 — 2026-11-09 — M8 hardening and runbook

- JWT secret from `JWT_SECRET`; production refuses missing, default, or short secrets
- HTTP errors omit stack traces unless `NODE_ENV=development`
- Shared DTO ValidationPipe (`whitelist` + `forbidNonWhitelisted`); required strings `@IsNotEmpty()`
- CORS origin from `CORS_ORIGIN` (prototype default: allow-all); rate limiting documented as not implemented
- `.env.example` matches running code; NestJS logger in bootstrap
- Root README runbook: clone → install → start ZenConnect → Device A/B or `demo:happy-path` / revoke / expiry
- `docs/PRODUCTION.md` lists prototype shortcuts (in-memory, no TLS) — not a production deploy
- M7 CLI clients unchanged

## v0.0.2 — 2026-10-31 — Prototype scaffolding

- **Architecture decisions locked:**
  - Backend stack: TypeScript/NestJS for ZenConnect (ADR-002 ACCEPTED)
  - Prototype authentication: email + password (ADR-001 ACCEPTED for prototype only; product auth upgradeable)
  - ZenControl boundary: deferred (ADR-003 OPEN)
- **NestJS ZenConnect prototype scaffolded:**
  - Monorepo structure under `packages/zenconnect/`
  - Core modules: gateway (API), identity (auth), devices, tasks, intent (adapter stub), transfers
  - Health endpoint and basic DTOs matching TDD entities
  - In-memory data stores for rapid prototyping
  - Local development setup with TypeScript, class-validator, class-transformer
  - README with setup and run instructions
- Documentation updated: ADR statuses, version bumped to 0.0.2

## v0.0.1 — 2026-10-31 — Docs only

- Initial documentation pack: README, overview, PRD (ZENONE-PRD-001), MVP (ZENONE-MVP-001), TDD (ZENONE-TDD-001), decisions (ZENONE-ADR-001), prototype plan, API sketch, security model.
- TDD §8 "Transfers" and failure handling completed as **[PROPOSED — not in source share]** (source cut off).
- Auth model and backend stack left open; options documented in `docs/04-decisions.md`.
- No code; no git remote.
