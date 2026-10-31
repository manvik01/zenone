#!/usr/bin/env ts-node

import { ZenClient } from './zen-client';
import chalk from 'chalk';
import * as crypto from 'crypto';

const BASE_URL = process.env.ZENCONNECT_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || `test-${Date.now()}@example.com`;
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SecurePass123!';

function log(message: string) {
  console.log(chalk.blue('→'), message);
}

function success(message: string) {
  console.log(chalk.green('✓'), message);
}

function error(message: string) {
  console.log(chalk.red('✗'), message);
}

function section(title: string) {
  console.log('\n' + chalk.bold.cyan(`${'='.repeat(60)}`));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan(`${'='.repeat(60)}\n`));
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runHappyPath() {
  try {
    section('ZenOne Happy Path Demo');

    // Initialize clients
    const clientA = new ZenClient({ baseUrl: BASE_URL });
    const clientB = new ZenClient({ baseUrl: BASE_URL });

    // Step 1: Register user
    section('Step 1: User Registration');
    log(`Registering user: ${TEST_EMAIL}`);
    const registration = await clientA.register(TEST_EMAIL, TEST_PASSWORD);
    success(`User registered: ${registration.userId}`);
    
    log(`Verifying email with token: ${registration.verificationToken.substring(0, 20)}...`);
    await clientA.verifyEmail(registration.verificationToken);
    success('Email verified');

    // Step 2: Login from both devices
    section('Step 2: Login from Two Devices');
    log('Device A logging in...');
    const sessionA = await clientA.login(TEST_EMAIL, TEST_PASSWORD);
    success(`Device A logged in (token: ${sessionA.accessToken.substring(0, 20)}...)`);

    log('Device B logging in...');
    const sessionB = await clientB.login(TEST_EMAIL, TEST_PASSWORD);
    success(`Device B logged in (token: ${sessionB.accessToken.substring(0, 20)}...)`);

    // Step 3: Pair Device A
    section('Step 3: Pair Device A');
    log('Starting pairing for Device A...');
    const pairA = await clientA.startPairing('Device-A', 'ANDROID', ['transfer', 'summarize']);
    success(`Device A pairing started: ${pairA.deviceId}`);
    log(`Pairing code: ${pairA.pairingCode}`);

    log('Confirming pairing for Device A...');
    const deviceA = await clientA.confirmPairing(pairA.deviceId, pairA.pairingCode);
    success(`Device A paired successfully: ${deviceA.deviceId}`);

    // Step 4: Pair Device B
    section('Step 4: Pair Device B');
    log('Starting pairing for Device B...');
    const pairB = await clientB.startPairing('Device-B', 'WINDOWS', ['transfer', 'summarize']);
    success(`Device B pairing started: ${pairB.deviceId}`);
    log(`Pairing code: ${pairB.pairingCode}`);

    log('Confirming pairing for Device B...');
    const deviceB = await clientB.confirmPairing(pairB.deviceId, pairB.pairingCode);
    success(`Device B paired successfully: ${deviceB.deviceId}`);

    // Step 5: List devices
    section('Step 5: List Devices');
    log('Listing all devices...');
    const devices = await clientA.listDevices();
    success(`Found ${devices.length} devices:`);
    devices.forEach(d => {
      console.log(`  - ${d.deviceName} (${d.platform}): ${d.trustStatus}, Online: ${d.isOnline}`);
    });

    // Step 6: Create grants for Device A (source)
    section('Step 6: Create Grants for Device A');
    log('Creating source path grant for Device A...');
    const sourceGrant = await clientA.createGrant(
      deviceA.deviceId,
      'file_path',
      '/tmp/source.txt',
      ['transfer']
    );
    success(`Source grant created: ${sourceGrant.grantId}`);

    log('Creating target path grant for Device B...');
    const targetGrant = await clientA.createGrant(
      deviceB.deviceId,
      'file_path',
      '/tmp/dest.txt',
      ['transfer']
    );
    success(`Target grant created: ${targetGrant.grantId}`);

    // Step 7: List grants
    section('Step 7: List Grants');
    log('Listing all grants...');
    const grants = await clientA.listGrants();
    success(`Found ${grants.length} grants:`);
    grants.forEach(g => {
      console.log(`  - ${g.deviceId}: ${g.resourcePath} [${g.capabilities.join(', ')}]`);
    });

    // Step 8: Create transfer_file task
    section('Step 8: Create Transfer File Task');
    const testContent = 'Hello from ZenOne!';
    const testDigest = crypto.createHash('sha256').update(testContent).digest('hex');
    const testByteCount = Buffer.byteLength(testContent);

    log('Creating transfer_file task...');
    const task = await clientA.createTask(
      deviceA.deviceId,
      deviceB.deviceId,
      'transfer_file',
      {
        sourcePath: '/tmp/source.txt',
        targetPath: '/tmp/dest.txt',
        expectedDigest: testDigest,
        expectedByteCount: testByteCount,
      }
    );
    success(`Task created: ${task.taskId}, State: ${task.state}`);
    console.log(`  Source: ${task.actionPayload.sourcePath}`);
    console.log(`  Target: ${task.actionPayload.targetPath}`);
    console.log(`  Expected digest: ${testDigest}`);
    console.log(`  Expected bytes: ${testByteCount}`);

    // Step 9: Approve task
    section('Step 9: Approve Task');
    log('Approving task...');
    const approved = await clientA.approveTask(task.taskId);
    success(`Task approved: ${approved.state}`);
    console.log(`  Approved at: ${approved.approvedAt}`);
    console.log(`  Approved by: ${approved.approvedBy}`);

    // Step 10: Execute task
    section('Step 10: Execute Task');
    log('Executing transfer...');
    const executed = await clientA.executeTask(task.taskId);
    success(`Task executed: ${executed.state}`);
    
    if (executed.state === 'SUCCEEDED') {
      console.log('  Transfer Result:');
      console.log(`    - Actual digest: ${executed.transferResult?.actualDigest}`);
      console.log(`    - Actual bytes: ${executed.transferResult?.actualByteCount}`);
      console.log(`    - Source grant checked: ${executed.transferResult?.sourceGrantChecked}`);
      console.log(`    - Target grant checked: ${executed.transferResult?.targetGrantChecked}`);
    } else if (executed.state === 'FAILED') {
      console.log(`  Failure reason: ${executed.failureReason}`);
    }

    // Step 11: Check task status
    section('Step 11: Check Task Status');
    log('Checking task status...');
    const status = await clientA.getTaskStatus(task.taskId);
    success(`Task status: ${status.state}`);
    console.log(`  Updated at: ${status.updatedAt}`);

    // Step 12: List tasks
    section('Step 12: List All Tasks');
    log('Listing all tasks...');
    const tasks = await clientA.listTasks();
    success(`Found ${tasks.length} tasks:`);
    tasks.forEach(t => {
      console.log(`  - ${t.taskId}: ${t.actionType} (${t.state})`);
    });

    section('✅ Happy Path Demo Complete!');
    console.log(chalk.green.bold('\nAll steps completed successfully!\n'));

  } catch (err: any) {
    error(`Error during happy path demo: ${err.message}`);
    if (err.response) {
      console.log(chalk.red('Response:'), JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the demo
runHappyPath();
