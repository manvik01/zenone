# ZenOne

> **One AI. Every Device. One Digital Life.**

ZenOne is a cross-platform personal AI assistant: one user identity, multiple trusted devices, shared AI context, and secure cross-device task execution (find, transfer, open, summarize) across operating systems.

| Product | Role |
|---|---|
| **ZenOne** | Consumer client / device agent (Android, Windows; iOS, macOS later) |
| **ZenConnect** | Cloud orchestration: device registry, presence, task routing, encrypted relay, context sync, AI intent routing |
| **ZenControl** | Security layer: device identity, consent, permission grants, policy, approvals, audit, revocation |

## Status

**v0.0.1 — documentation only.** No code yet. Code starts after the open critical decisions in [`docs/04-decisions.md`](docs/04-decisions.md) and [`docs/05-prototype-plan.md`](docs/05-prototype-plan.md#remaining-critical-decisions) are made.

- MVP platforms: **Android + Windows**. iOS/macOS are designed in, shipped later.
- Auth model: **open** (options documented).
- Backend stack: **open** (alternatives documented).
- Target home: private GitHub repo `zenone` (not yet created/pushed).

## How to read these docs

| # | Doc | Read it for |
|---|---|---|
| 00 | [Overview](docs/00-overview.md) | Vision, stack diagram, boundaries — start here |
| 01 | [PRD](docs/01-prd.md) (ZENONE-PRD-001) | What and why: journeys, requirements, metrics |
| 02 | [MVP](docs/02-mvp.md) (ZENONE-MVP-001) | 12-week private beta scope and roadmap |
| 03 | [TDD](docs/03-tdd.md) (ZENONE-TDD-001) | Reference architecture, services, data model, lifecycle |
| 04 | [Decisions](docs/04-decisions.md) | Open ADRs: auth, backend, repo layout |
| 05 | [Prototype plan](docs/05-prototype-plan.md) | First prototype scope after decisions; decision checklist |
| 06 | [API sketch](docs/06-api-sketch.md) | REST endpoints with JSON examples |
| 07 | [Security](docs/07-security.md) | Security model and ZenControl's role |

Suggested path: 00 → 01 → 02 → 03 → 07 → 04 → 05 → 06.

## Conventions

- Content marked **[PROPOSED — not in source share]** was added to complete a truncated section of the source; everything else is faithful to the source PRD/MVP/TDD.
- Targets and metrics are proposed, not achieved results.

## Source

Derived from the ChatGPT share "AI Evolution for WhatsApp" (Documents 1–3: PRD, MVP, TDD). The source TDD is truncated in §8.

See [CHANGELOG.md](CHANGELOG.md).
