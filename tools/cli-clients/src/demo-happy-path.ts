#!/usr/bin/env ts-node

import { ZenClient } from './zen-client';
import { log, success, section, sanitizeToken } from './cli-helpers';
import { 
  setupUserAndDevices, 
  createGrants, 
  generateTestContent,
  createAndApproveTask,
  displayTaskResult 
} from './demo-helpers';
import chalk from 'chalk';

const BASE_URL = process.env.ZENCONNECT_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || `test-${Date.now()}@example.com`;
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SecurePass123!';

async function runHappyPath(): Promise<void> {
  try {
    section('ZenOne Happy Path Demo');

    const clientA = new ZenClient({ baseUrl: BASE_URL });
    const clientB = new ZenClient({ baseUrl: BASE_URL });

    section('Step 1: User Registration');
    log(`Registering user: ${TEST_EMAIL}`);
    const registration = await clientA.register(TEST_EMAIL, TEST_PASSWORD);
    success(`User registered: ${registration.userId}`);
    
    log(`Verifying email with token: ${sanitizeToken(registration.verificationToken)}`);
    await clientA.verifyEmail(registration.verificationToken);
    success('Email verified');

    section('Step 2: Login from Two Devices');
    log('Device A logging in...');
    const sessionA = await clientA.login(TEST_EMAIL, TEST_PASSWORD);
    success(`Device A logged in (token: ${sanitizeToken(sessionA.accessToken)})`);

    log('Device B logging in...');
    const sessionB = await clientB.login(TEST_EMAIL, TEST_PASSWORD);
    success(`Device B logged in (token: ${sanitizeToken(sessionB.accessToken)})`);

    section('Step 3: Pair Device A');
    log('Starting pairing for Device A...');
    const pairA = await clientA.startPairing('Device-A', 'ANDROID', ['transfer', 'summarize']);
    success(`Device A pairing started: ${pairA.deviceId}`);
    log(`Pairing code: ${pairA.pairingCode}`);

    log('Confirming pairing for Device A...');
    const deviceA = await clientA.confirmPairing(pairA.deviceId, pairA.pairingCode);
    success(`Device A paired successfully: ${deviceA.deviceId}`);

    section('Step 4: Pair Device B');
    log('Starting pairing for Device B...');
    const pairB = await clientB.startPairing('Device-B', 'WINDOWS', ['transfer', 'summarize']);
    success(`Device B pairing started: ${pairB.deviceId}`);
    log(`Pairing code: ${pairB.pairingCode}`);

    log('Confirming pairing for Device B...');
    const deviceB = await clientB.confirmPairing(pairB.deviceId, pairB.pairingCode);
    success(`Device B paired successfully: ${deviceB.deviceId}`);

    section('Step 5: List Devices');
    log('Listing all devices...');
    const devices = await clientA.listDevices();
    success(`Found ${devices.length} devices:`);
    devices.forEach(d => {
      console.log(`  - ${d.deviceName} (${d.platform}): ${d.trustStatus}, Online: ${d.isOnline}`);
    });

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

    section('Step 7: List Grants');
    log('Listing all grants...');
    const grants = await clientA.listGrants();
    success(`Found ${grants.length} grants:`);
    grants.forEach(g => {
      console.log(`  - ${g.deviceId}: ${g.resourcePath} [${g.capabilities.join(', ')}]`);
    });

    section('Step 8: Create Transfer File Task');
    const testData = generateTestContent();

    log('Creating transfer_file task...');
    const task = await clientA.createTask(
      deviceA.deviceId,
      deviceB.deviceId,
      'transfer_file',
      {
        sourcePath: '/tmp/source.txt',
        targetPath: '/tmp/dest.txt',
        expectedDigest: testData.digest,
        expectedByteCount: testData.byteCount,
      }
    );
    success(`Task created: ${task.taskId}, State: ${task.state}`);
    console.log(`  Source: ${task.actionPayload.sourcePath}`);
    console.log(`  Target: ${task.actionPayload.targetPath}`);
    console.log(`  Expected digest: ${testData.digest}`);
    console.log(`  Expected bytes: ${testData.byteCount}`);

    section('Step 9: Approve Task');
    log('Approving task...');
    const approved = await clientA.approveTask(task.taskId);
    success(`Task approved: ${approved.state}`);
    console.log(`  Approved at: ${approved.approvedAt || 'N/A'}`);
    console.log(`  Approved by: ${approved.approvedBy || 'N/A'}`);

    section('Step 10: Execute Task');
    log('Executing transfer...');
    const executed = await clientA.executeTask(task.taskId);
    success(`Task executed: ${executed.state}`);
    
    displayTaskResult(executed);

    section('Step 11: Check Task Status');
    log('Checking task status...');
    const status = await clientA.getTaskStatus(task.taskId);
    success(`Task status: ${status.state}`);
    console.log(`  Updated at: ${status.updatedAt}`);

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
    console.error(chalk.red(`✗ Error during happy path demo: ${err.message}`));
    if (err.response) {
      console.log(chalk.red('Response:'), JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

runHappyPath();
