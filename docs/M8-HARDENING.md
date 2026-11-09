# M8: Prototype hardening and runbook

**Status:** Complete  
**Milestone:** M8 (Z1-9)  
**Date:** 2026-11-09

## Overview

M8 hardens obvious prototype footguns in NestJS ZenConnect and adds a root README runbook so someone can clone the repo, start the server, run the existing M7 CLI clients, and replay the happy path.

M7 clients under `tools/cli-clients` are unchanged.

## Hardening

| Footgun | Change |
|---|---|
| JWT secret | `getJwtSecret()` reads `JWT_SECRET`. Production refuses missing, default, or short secrets. `JwtModule.registerAsync` evaluates the secret at bootstrap. |
| `.env` | `loadEnvFile()` reads `packages/zenconnect/.env` without a dotenv dependency. Existing env wins. |
| Stack traces | `HttpExceptionFilter` omits `stack` unless `NODE_ENV=development`. Unexpected errors become generic 500s outside development. |
| DTO validation | Shared `createValidationPipe()` (`whitelist`, `forbidNonWhitelisted`, `transform`) in `main.ts` and identity HTTP tests. Required string fields use `@IsNotEmpty()`. |
| CORS / rate limit | CORS origin from `CORS_ORIGIN` (default allow-all). Rate limiting is **not** implemented; documented in README and `docs/PRODUCTION.md`. |
| Logging | NestJS `Logger` in bootstrap (replaces `console.log`). |
| Demo-blocking comments | `.env.example` no longer says JWT is unimplemented. ZenConnect README status matches M1–M8. |
| Raw `Error` on HTTP | `GET /v1/transfers/:id` uses `NotFoundException`. Intent parse maps failures to `BadRequestException`. |

## Runbook

See the root [README](../README.md): clone → install → start ZenConnect → `demo:happy-path` / Device A+B.

## Tests

New unit tests: `common/config.spec.ts`, `common/http-exception.filter.spec.ts`. Identity register rejects unknown fields. ZenControl controller spec now overrides `JwtAuthGuard` (same pattern as devices/tasks; the gap was left on main after M7). Existing M1–M6 tests stay in `packages/zenconnect`.

## Scope lock

- No Journey C, LLM router, shell, bookings, real Android/Windows apps
- No production DB/TLS/CI
- No ADR-004, no prototype-plan rewrite (one-line status only)
