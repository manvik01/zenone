# ZenOne

> **One AI. Every Device. One Digital Life.**

ZenOne is a cross-platform personal AI assistant: one user identity, multiple trusted devices, and secure cross-device task execution. This repository is the **local prototype**: NestJS **ZenConnect** plus simulated CLI clients. It is not a production deploy.

| Product | Role in this repo |
|---|---|
| **ZenConnect** | `packages/zenconnect` — identity, devices, ZenControl grants, tasks, transfer stub |
| **ZenOne clients** | `tools/cli-clients` — Device A / Device B and automated demos (M7) |
| **ZenControl** | Module inside ZenConnect (ADR-003 still open) |

## Status

**v0.0.3 — M0–M8 prototype.** Identity, pairing, grants, `transfer_file` state machine, transfer stub, simulated CLI clients, and hardening/runbook. Happy path is runnable locally. Shared conversation sync (Journey C) and a real AI router are out of scope.

## Runbook

Requires **Node.js 20+**. Two packages, two `npm install`s — there is no root workspace.

### 1. Clone

```bash
git clone https://github.com/manvik01/zenone.git
cd zenone
```

### 2. Install

```bash
cd packages/zenconnect && npm install
cd ../../tools/cli-clients && npm install
```

### 3. Configure (optional for local demo)

```bash
cd packages/zenconnect
cp .env.example .env
# Edit JWT_SECRET if you want; development falls back to a default and logs a warning.
```

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | unset / `development` in `.env.example` | Stack traces only when `development` |
| `JWT_SECRET` | well-known dev default | **Required** in production: non-default, ≥ 32 chars |
| `CORS_ORIGIN` | `*` (allow all) | Comma-separated origins to restrict |
| `ZENCONNECT_URL` | `http://localhost:3000` | CLI clients / demos only |

Rate limiting is **not** implemented (prototype). See [docs/PRODUCTION.md](docs/PRODUCTION.md).

### 4. Start ZenConnect

```bash
cd packages/zenconnect
npm run start:dev
```

Health: [http://localhost:3000/health](http://localhost:3000/health)

Leave this process running. Data is **in-memory** — restarting the server clears accounts, devices, and tasks.

### 5. Replay the happy path

In another terminal:

```bash
cd tools/cli-clients
npm run demo:happy-path
```

Expected finish: `All steps completed successfully!`

Other existing demos (do not require rebuilding clients):

```bash
npm run demo:revoke    # revoked device cannot be a task source/target
npm run demo:expiry    # QUEUED task expiry
```

### 6. Two simulated devices (interactive)

Two terminals, server still running:

```bash
cd tools/cli-clients
npm run device-a
```

```bash
cd tools/cli-clients
npm run device-b
```

Manual steps (same account on both):

1. **Device A:** register → login → pair (`ANDROID`) → note device id  
2. **Device B:** login (same email/password) → pair (`WINDOWS`) → note device id  
3. **Device A:** list devices; create grants for both paths; create `transfer_file` task; approve; execute  

Walkthrough, digest, and byte-count values: [tools/cli-clients/README.md](tools/cli-clients/README.md).

## Tests

```bash
cd packages/zenconnect
npm test
npm run typecheck
```

CLI clients have no separate test suite; they exercise the live server.

## Known prototype limits

- **In-memory stores** — nothing survives a restart  
- **No TLS** — HTTP only; put TLS in front if you ever expose this  
- **CORS allow-all** unless `CORS_ORIGIN` is set  
- **No rate limiting**  
- **Email tokens in JSON** — verification and password-reset tokens are returned in the API so the CLI can run without a mailer  
- **Keyword intent stub** — not an LLM router  
- **Simulated clients** — not real Android/Windows apps  
- **Single process** — no queue, no multi-instance presence  

Details: [docs/PRODUCTION.md](docs/PRODUCTION.md). Security model: [docs/07-security.md](docs/07-security.md).

## How to read these docs

| # | Doc | Read it for |
|---|---|---|
| 00 | [Overview](docs/00-overview.md) | Vision, stack diagram, boundaries |
| 01 | [PRD](docs/01-prd.md) | Journeys and requirements |
| 02 | [MVP](docs/02-mvp.md) | 12-week private beta scope |
| 03 | [TDD](docs/03-tdd.md) | Reference architecture |
| 04 | [Decisions](docs/04-decisions.md) | ADRs |
| 05 | [Prototype plan](docs/05-prototype-plan.md) | Happy-path subset |
| 06 | [API sketch](docs/06-api-sketch.md) | REST examples |
| 07 | [Security](docs/07-security.md) | ZenControl model |
| — | [PRODUCTION.md](docs/PRODUCTION.md) | Prototype shortcuts (not a deploy guide) |
| — | [M7 clients](docs/M7-CLIENTS.md) | Simulated Device A/B |
| — | [M8 hardening](docs/M8-HARDENING.md) | Footguns closed in this milestone |

Suggested path: runbook (this file) → 00 → 07 → 05 → CLI README.

## Conventions

- Content marked **[PROPOSED — not in source share]** was added to complete a truncated section of the source.
- Targets and metrics are proposed, not achieved results.

## Source

Derived from the ChatGPT share "AI Evolution for WhatsApp" (Documents 1–3: PRD, MVP, TDD). The source TDD is truncated in §8.

See [CHANGELOG.md](CHANGELOG.md).
