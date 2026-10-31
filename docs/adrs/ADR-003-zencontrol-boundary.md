# ADR-003: ZenControl Boundary (Open Decision)

**Status:** Proposed  
**Date:** 2026-10-31  
**Deciders:** ZenOne Development Team, Product

## Context

ZenOne's core value proposition is **zero-trust device control** with typed actions and human-in-the-loop approval. The system must define boundaries around what actions are permitted vs. prohibited to maintain trust and security.

**Current Scope (MVP-05 Typed Actions):**
- `transfer_file`: File transfer with checksum validation, approved folders only

**Key Product Questions:**
1. What is the full taxonomy of typed actions beyond `transfer_file`?
2. Where is the boundary between "safe automation" and "dangerous automation"?
3. How do we balance user empowerment with security guarantees?

## Decision

This ADR documents the **open decision** status. The ZenControl boundary will be defined through:

1. **Iterative Expansion**: Start with `transfer_file` (M0-M8), add typed actions based on user research
2. **Capability Declaration**: Devices advertise supported actions; server enforces whitelist
3. **Audit Trail**: All approved/rejected actions logged for product learning

## Scope Lock Compliance (Enforced Now)

**Explicitly EXCLUDED per acceptance-gates.md:**
- ❌ **Arbitrary shell execution**: No `run_command` or `exec` action types
- ❌ **Unrestricted accessibility automation**: No blind UI scripting
- ❌ **iOS/macOS clients**: Platform scope limited to Android, Linux, Windows for MVP
- ❌ **Voice commands (FR-12)**: Not in prototype scope
- ❌ **3P integrations**: No booking systems, WhatsApp, banking APIs
- ❌ **FR-13/14**: Deferred unless already in MVP-05 typed actions (summarize/list)

**Permitted (if added as typed actions):**
- ✅ File operations in approved directories
- ✅ Screenshot/screen-sharing (with explicit consent)
- ✅ Calendar/notification queries (read-only, explicit types)
- ✅ Device status queries (battery, network, capabilities)

## Consequences

### Keeping Decision Open
- **Pro**: Flexibility to learn from prototype usage patterns
- **Pro**: Avoids premature taxonomy that might miss user needs
- **Con**: Ambiguity may slow feature prioritization
- **Con**: Risk of scope creep if not actively managed

### Enforcement Mechanisms
- **Server-side validation**: Reject unknown action types with clear error messages
- **Typed action schemas**: Each action has strict input validation (JSON Schema)
- **Capability negotiation**: Devices declare supported actions at pairing time
- **Receipt verification**: Completed tasks include action type in signed receipt

## Deferred Questions

1. **Clipboard access**: Should devices share clipboard contents? (Privacy concern)
2. **Notification sending**: Can one device trigger notifications on another?
3. **Application launching**: Permitted if app list is pre-approved?
4. **File deletion**: Is delete a separate action from transfer, or same action with delete flag?
5. **Batch operations**: Can one task include multiple file transfers?

## Decision Process

This ADR will be updated when:
- User research surfaces priority use cases
- Security review identifies boundary violations
- Additional typed actions reach implementation phase

## References

- Scope exclusions: docs/acceptance-gates.md
- MVP-05 typed actions: Gate 3 (Tasks) in acceptance gates
- Least privilege principle: NFR security requirements
