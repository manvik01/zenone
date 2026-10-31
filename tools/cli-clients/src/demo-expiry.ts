#!/usr/bin/env ts-node

import { ZenClient } from './zen-client';
import chalk from 'chalk';
import * as crypto from 'crypto';

const BASE_URL = process.env.ZENCONNECT_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || `test-expiry-${Date.now()}@example.com`;
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

async function runExpiryDemo() {
  try {
    section('ZenOne Task Expiry Demo');

    const client = new ZenClient({ baseUrl: BASE_URL });

    // Setup
    section('Setup: Register and Pair Devices');
    log(`Registering user: ${TEST_EMAIL}`);
    const registration = await client.register(TEST_EMAIL, TEST_PASSWORD);
    await client.verifyEmail(registration.verificationToken);
    success('User registered and verified');

    await client.login(TEST_EMAIL, TEST_PASSWORD);
    success('User logged in');

    // Pair devices
    const pairA = await client.startPairing('Device-A', 'ANDROID', ['transfer']);
    await client.confirmPairing(pairA.deviceId, pairA.pairingCode);
    success(`Device A paired: ${pairA.deviceId}`);

    const pairB = await client.startPairing('Device-B', 'WINDOWS', ['transfer']);
    await client.confirmPairing(pairB.deviceId, pairB.pairingCode);
    success(`Device B paired: ${pairB.deviceId}`);

    // Create grants
    await client.createGrant(pairA.deviceId, 'file_path', '/tmp/source.txt', ['transfer']);
    await client.createGrant(pairB.deviceId, 'file_path', '/tmp/dest.txt', ['transfer']);
    success('Grants created');

    // Demonstrate QUEUED → EXPIRED
    section('Scenario: Task Expiry');
    const testContent = 'Test content for expiry';
    const testDigest = crypto.createHash('sha256').update(testContent).digest('hex');
    const testByteCount = Buffer.byteLength(testContent);

    log('Creating task that will expire (default expiry is short)...');
    const task = await client.createTask(
      pairA.deviceId,
      pairB.deviceId,
      'transfer_file',
      {
        sourcePath: '/tmp/source.txt',
        targetPath: '/tmp/dest.txt',
        expectedDigest: testDigest,
        expectedByteCount: testByteCount,
      }
    );
    success(`Task created: ${task.taskId}, State: ${task.state}`);
    console.log(`  Expires at: ${task.expiresAt}`);

    // Note: The default expiry in the system is set in the tasks service
    // For demonstration, we'll check the status after a delay
    log('Waiting for task to expire (checking periodically)...');
    
    let currentState = task.state;
    let attempts = 0;
    const maxAttempts = 12; // 60 seconds total
    
    while (currentState !== 'EXPIRED' && attempts < maxAttempts) {
      await wait(5000); // Wait 5 seconds
      attempts++;
      
      const status = await client.getTaskStatus(task.taskId);
      currentState = status.state;
      
      console.log(`  [${attempts * 5}s] Current state: ${currentState}`);
      
      if (currentState === 'EXPIRED') {
        success('Task has expired!');
        break;
      }
    }

    if (currentState !== 'EXPIRED') {
      log('Task has not expired yet within the waiting period.');
      log('Note: Task expiry is handled by the server background process.');
      console.log(chalk.yellow('  You can run `npm run demo:happy-path` and then check this task again.'));
    }

    // Show final task state
    section('Final Task State');
    const finalTask = await client.getTask(task.taskId);
    console.log(chalk.white('Task details:'));
    console.log(`  Task ID: ${finalTask.taskId}`);
    console.log(`  State: ${finalTask.state}`);
    console.log(`  Created: ${finalTask.createdAt}`);
    console.log(`  Expires: ${finalTask.expiresAt}`);
    console.log(`  Updated: ${finalTask.updatedAt}`);

    section('✅ Expiry Demo Complete');
    console.log(chalk.green.bold('\nExpiry scenario demonstrated!\n'));

  } catch (err: any) {
    error(`Error during expiry demo: ${err.message}`);
    if (err.response) {
      console.log(chalk.red('Response:'), JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the demo
runExpiryDemo();
