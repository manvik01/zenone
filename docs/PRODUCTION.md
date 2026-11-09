# ZenOne prototype shortcuts

This is **not** a production deploy guide. ZenConnect is a local prototype. The items below are intentional shortcuts — do not treat a green happy-path demo as production-ready.

## Do not build from this document

No real database, TLS terminator, CI pipeline, or hosted deploy is in scope for M8.

## Shortcuts

| Area | Prototype behavior | Production expectation |
|---|---|---|
| Storage | In-memory `Map`s. Restart wipes users, sessions, devices, grants, tasks. | PostgreSQL + Redis (or equivalent) with TTL |
| Transport | HTTP on `localhost`. No TLS. | TLS 1.2+ in front of the API |
| JWT | HMAC-SHA256 secret from `JWT_SECRET` (dev default allowed). | Strong secret (or KMS), rotation, no default |
| CORS | Allow-all unless `CORS_ORIGIN` is set | Explicit origin allowlist |
| Rate limiting | **Not implemented** | Per-IP / per-account limits on auth and pairing |
| Email | Verification and reset tokens returned in JSON | Out-of-band email; never return secrets in the body |
| Intent router | Keyword stub (`/v1/intent/parse`) | Real AI router with consent (out of prototype scope) |
| Transfer | In-process stub + SHA-256 / byte count | Encrypted relay or direct transfer, real filesystem ACL |
| Clients | Simulated CLI under `tools/cli-clients` | Android + Windows apps |
| Process | Single NestJS process, no queue | Durable task queue, multi-instance presence |
| Logging | NestJS logger; stacks only when `NODE_ENV=development` | Structured logs, no secrets, redaction |
| `/v1/transfers` | Unauthenticated legacy relay endpoints | JWT + device auth on every transfer API |

## What M8 did harden

- `JWT_SECRET` from env; production refuses missing/default/short secrets
- Global DTO validation (`whitelist` + `forbidNonWhitelisted`)
- HTTP errors omit stack traces unless `NODE_ENV=development`
- CORS origin configurable; rate-limit absence documented
- `.env.example` matches the code that actually runs

## Related

- [README runbook](../README.md)
- [Security model](07-security.md)
- [CLI clients](../tools/cli-clients/README.md)
