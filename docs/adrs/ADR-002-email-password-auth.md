# ADR-002: Email/Password Authentication (Prototype Only)

**Status:** Accepted  
**Date:** 2026-10-31  
**Deciders:** ZenOne Development Team

## Context

ZenOne MVP (M0-M8) requires user authentication to satisfy Gate 1 (Identity) acceptance criteria:
- Email registration with password
- Authentication and session management
- Same account usable from two clients simultaneously

This is a **prototype implementation** focused on validating the device control and task execution model, not production-grade identity management.

## Decision

Implement **email/password authentication** with:
- Plain email + password registration (no email verification for prototype)
- Session-based authentication using secure HTTP-only cookies
- Multiple concurrent sessions per user (device independence)
- Password hashing with bcrypt
- No password reset, OAuth, or MFA in prototype scope

Implementation approach:
- NestJS Guards for route protection
- Passport.js with local strategy
- Session storage (initially in-memory, can upgrade to Redis)
- User entity with hashed passwords

## Consequences

### Positive
- **Simplicity**: Straightforward implementation unblocks device pairing work
- **TDD Friendly**: Easy to test authentication flows with mock users
- **No External Dependencies**: No OAuth provider setup or API keys needed
- **Fast Iteration**: Minimal ceremony for creating test accounts
- **Multi-Session Support**: Natural fit for testing device scenarios

### Negative
- **Not Production Ready**: Missing security hardening (rate limiting, account recovery, email verification)
- **Manual Account Creation**: No self-service password reset
- **Migration Required**: Will need replacement or significant hardening for production
- **Limited Security**: No defense against credential stuffing, brute force attacks

## Security Considerations (Prototype Scope)

**Implemented:**
- Passwords hashed with bcrypt (cost factor 10)
- HTTP-only, secure cookies for session tokens
- HTTPS in production (documented stub for local dev)

**Deferred (Beyond M8):**
- Email verification
- Password strength enforcement
- Rate limiting on login attempts
- Account lockout after failed attempts
- Password reset flow
- OAuth/SSO integration
- Multi-factor authentication
- Session timeout policies

## Scope Lock Compliance

**Excluded per acceptance-gates.md:**
- No voice authentication (FR-12 excluded)
- No third-party identity providers
- No enterprise SSO features

## Alternatives Considered

1. **OAuth Only (Google/GitHub)**: Cleaner security model but adds external dependencies and complicates automated testing. Rejected for prototype to minimize setup friction.

2. **JWT Tokens**: Stateless authentication but complicates multi-device session revocation (required by Gate 2). Session-based is simpler for prototype device management.

3. **Magic Links**: Requires email infrastructure. Overkill for prototype and blocks TDD workflow.

## Migration Path

For production:
- Add email verification flow
- Implement OAuth2 providers (Google, GitHub)
- Add rate limiting and account security features
- Consider replacing with established identity service (Auth0, Clerk, Keycloak)
- Add audit logging for authentication events

## References

- Gate 1 acceptance criteria (docs/acceptance-gates.md)
- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
