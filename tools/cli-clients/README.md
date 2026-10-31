# ZenOne CLI Clients

Simulated CLI clients for demonstrating the ZenOne happy path end-to-end.

## Overview

This package provides:
- **Thin CLI clients** for two simulated devices (Device A and Device B)
- **Automated demo scripts** for happy path, expiry, and revocation scenarios
- **Shared client library** (`ZenClient`) for API interactions

## Prerequisites

1. **ZenConnect server must be running:**
   ```bash
   cd packages/zenconnect
   npm install
   npm run start:dev
   ```
   The server will run on `http://localhost:3000` by default.

2. **Install CLI client dependencies:**
   ```bash
   cd tools/cli-clients
   npm install
   ```

## Quick Start

### Automated Demos

The easiest way to see ZenOne in action is to run the automated demos:

#### 1. Happy Path Demo
Complete end-to-end flow from registration to transfer execution:

```bash
npm run demo:happy-path
```

This demonstrates:
- User registration and email verification
- Logging in from two devices
- Device pairing (Device A and Device B)
- Creating grants for both devices
- Creating a transfer_file task
- Approving the task
- Executing the transfer
- Validating digest and byte count

#### 2. Task Expiry Demo
Shows how tasks expire when not executed in time:

```bash
npm run demo:expiry
```

This demonstrates:
- Creating a task that will expire
- Monitoring the task state (QUEUED → EXPIRED)
- How the system handles expired tasks

#### 3. Device Revocation Demo
Shows that revoked devices cannot participate in tasks:

```bash
npm run demo:revoke
```

This demonstrates:
- Creating tasks before revocation (succeeds)
- Revoking Device B
- Attempting to create tasks with revoked device (fails)
- Enforcement at both source and target

### Interactive CLI Clients

For manual testing and exploration, use the interactive CLI clients:

#### Device A
```bash
npm run device-a
```

#### Device B  
```bash
npm run device-b
```

Both clients provide an interactive menu with commands for:
- Registration (Device A only)
- Login
- Device pairing
- Grant management
- Task creation and management
- Device revocation
- Presence updates

## Environment Variables

- `ZENCONNECT_URL`: Server URL (default: `http://localhost:3000`)
- `TEST_EMAIL`: Email for automated demos (default: auto-generated)
- `TEST_PASSWORD`: Password for automated demos (default: `SecurePass123!`)

Example:
```bash
ZENCONNECT_URL=http://localhost:4000 npm run demo:happy-path
```

## Manual Happy Path Flow

If you want to manually step through the happy path using the interactive clients:

1. **Start ZenConnect server:**
   ```bash
   cd packages/zenconnect
   npm run start:dev
   ```

2. **Start Device A client in one terminal:**
   ```bash
   cd tools/cli-clients
   npm run device-a
   ```

3. **Start Device B client in another terminal:**
   ```bash
   cd tools/cli-clients
   npm run device-b
   ```

4. **Follow these steps:**

   **In Device A:**
   - Choose `1` - Register (e.g., `test@example.com` / `SecurePass123!`)
   - Choose `2` - Login
   - Choose `3` - Pair Device (name: `Device-A`, platform: `ANDROID`)
   - Note the Device ID

   **In Device B:**
   - Choose `1` - Login (same email/password)
   - Choose `2` - Pair Device (name: `Device-B`, platform: `WINDOWS`)
   - Note the Device ID

   **In Device A:**
   - Choose `4` - List Devices (verify both are present)
   - Choose `5` - Create Grant for Device A
     - Device ID: (Device A's ID)
     - Resource Type: `file_path`
     - Resource Path: `/tmp/source.txt`
     - Capabilities: `transfer`
   - Choose `5` - Create Grant for Device B
     - Device ID: (Device B's ID)
     - Resource Type: `file_path`
     - Resource Path: `/tmp/dest.txt`
     - Capabilities: `transfer`
   - Choose `7` - Create Transfer Task
     - Source Device ID: (Device A's ID)
     - Target Device ID: (Device B's ID)
     - Source Path: `/tmp/source.txt`
     - Target Path: `/tmp/dest.txt`
     - Expected Digest: `d2a84f4b8b650937ec8f73cd8be2c74add5a911ba64df27458ed8229da804a26`
     - Expected Byte Count: `19`
   - Note the Task ID
   - Choose `8` - Approve Task (enter Task ID)
   - Choose `9` - Execute Task (enter Task ID)
   - Verify the task state is `SUCCEEDED`

## Expected Outputs

### Happy Path Success
```
✅ Happy Path Demo Complete!
All steps completed successfully!
```

### Expiry Demo
```
Task has expired!
✅ Expiry Demo Complete
```

### Revocation Demo
```
Task creation correctly rejected!
Error message: Source device is revoked
✅ Revocation Demo Complete
```

## Test Values

For the happy path demo, these are the correct digest and byte count for the test content:

- **Test Content:** `"Hello from ZenOne!"`
- **SHA-256 Digest:** `d2a84f4b8b650937ec8f73cd8be2c74add5a911ba64df27458ed8229da804a26`
- **Byte Count:** `19`

The automated demos calculate these automatically.

## Architecture

```
tools/cli-clients/
├── src/
│   ├── zen-client.ts          # Shared API client library
│   ├── demo-happy-path.ts     # Automated happy path demo
│   ├── demo-expiry.ts         # Task expiry demonstration
│   ├── demo-revoke.ts         # Device revocation demonstration
│   ├── device-a.ts            # Interactive CLI for Device A
│   └── device-b.ts            # Interactive CLI for Device B
├── package.json
├── tsconfig.json
└── README.md
```

## API Coverage

The clients demonstrate all M1-M6 functionality:

### M1: Identity (Gate 1)
- ✓ Register with email/password
- ✓ Email verification
- ✓ Login/session management
- ✓ Same account from multiple clients

### M2: Devices (Gate 2)
- ✓ Device pairing (start + confirm)
- ✓ List devices with presence
- ✓ Device revocation
- ✓ Revoked device enforcement

### M3: ZenControl (Gate 4)
- ✓ Create grants
- ✓ List grants
- ✓ Grant enforcement in transfers

### M4: Tasks (Gate 3)
- ✓ Create transfer_file tasks
- ✓ Approve tasks
- ✓ Cancel tasks
- ✓ List tasks
- ✓ Task status queries
- ✓ Task expiry

### M5: Transfer Execution (Gate 4)
- ✓ Execute transfer
- ✓ Digest validation (SHA-256)
- ✓ Byte count verification
- ✓ ACL enforcement

## Troubleshooting

### Connection Refused
- Ensure ZenConnect server is running on `http://localhost:3000`
- Check the server logs for errors

### 401 Unauthorized
- Make sure you've logged in before calling protected endpoints
- Token might have expired; try logging in again

### Task Creation Fails with "Device revoked"
- This is expected behavior! Check if you're using a revoked device
- Use the revocation demo to see this in action

### Task Execution Fails with "Digest mismatch"
- Ensure you're using the correct SHA-256 digest
- The happy path demo uses the correct values automatically

## Next Steps

After verifying the clients work:
1. Review the automated demos to understand the flows
2. Use interactive clients to test edge cases
3. Examine the `zen-client.ts` library for API patterns
4. Run demos as part of your testing workflow
