# ADR-001: NestJS + TypeScript Technology Stack

**Status:** Accepted  
**Date:** 2026-10-31  
**Deciders:** ZenOne Development Team

## Context

ZenOne is a zero-trust device control system prototype that requires a robust, type-safe backend framework supporting rapid development while maintaining production-ready code quality. The system must support:

- Strict type safety for security-critical operations
- Test-driven development (TDD) workflow
- RESTful API endpoints for device management and task coordination
- Session management and authentication
- Real-time device presence tracking
- Task state machine implementation

## Decision

We will use **NestJS** with **TypeScript** (strict mode) as the backend framework for ZenConnect service.

Technology choices:
- **NestJS 10.x**: Opinionated framework with built-in dependency injection, module system, and testing support
- **TypeScript 5.x**: With strict mode enabled for maximum type safety
- **Jest**: Testing framework for unit and integration tests
- **Express**: Underlying HTTP framework (NestJS default)

## Consequences

### Positive
- **Type Safety**: Strict TypeScript catches potential security issues at compile time
- **TDD Support**: Jest is first-class in NestJS with excellent testing utilities
- **Structure**: Opinionated architecture enforces consistent patterns across the codebase
- **Ecosystem**: Large NestJS ecosystem for auth, validation, database integration
- **Documentation**: Excellent official documentation and community resources
- **Decorator Pattern**: Clean, declarative API definitions suitable for typed actions
- **Testability**: Built-in dependency injection makes mocking straightforward

### Negative
- **Learning Curve**: Developers unfamiliar with NestJS/decorators need onboarding
- **Overhead**: More boilerplate than minimal Express/Fastify setups
- **Framework Lock-in**: Architectural decisions tied to NestJS patterns
- **Bundle Size**: Larger runtime footprint than micro-frameworks

## Alternatives Considered

1. **Express.js + TypeScript**: Minimal and flexible, but requires building structure from scratch. Rejected because TDD infrastructure and consistent architecture are critical for this security-focused prototype.

2. **Fastify + TypeScript**: Better performance than Express, but less mature NestJS integration and smaller ecosystem. Performance is not a primary concern for the prototype.

3. **Python (FastAPI)**: Excellent type hints and API generation, but team expertise is stronger in TypeScript, and sharing types with future web client is valuable.

## References

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- ZenOne PRD acceptance gates (docs/acceptance-gates.md)
