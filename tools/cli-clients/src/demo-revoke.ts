#!/usr/bin/env ts-node

import { ZenClient } from './zen-client';
import chalk from 'chalk';
import * as crypto from 'crypto';

const BASE_URL = process.env.ZENCONNECT_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || `test-revoke-${Date.now()}@example.com`;
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

function info(message: string) {
  console.log(chalk.yellow('ℹ'), message);
}

function section(title: string) {
  console.log('\n' + chalk.bold.cyan(`${'='.repeat(60)}`));
  console.log(chalk.bold.cyan(`  ${title}`));
  console.log(chalk.bold.cyan(`${'='.repeat(60)}\n`));
}

async function runRevokeDemo() {
  try {
    section('ZenOne Device Revocation Demo');

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
    success('Grants created for both devices');

    // Show devices before revocation
    section('Before Revocation');
    const devicesBefore = await client.listDevices();
    console.log(chalk.white('Active devices:'));
    devicesBefore.forEach(d => {
      console.log(`  - ${d.deviceName} (${d.platform}): ${d.trustStatus}`);
    });

    // Test 1: Create task before revocation (should succeed)
    section('Test 1: Create Task Before Revocation');
    const testContent = 'Test content';
    const testDigest = crypto.createHash('sha256').update(testContent).digest('hex');
    const testByteCount = Buffer.byteLength(testContent);

    log('Creating transfer task from Device A to Device B...');
    const task1 = await client.createTask(
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
    success(`Task created successfully: ${task1.taskId}, State: ${task1.state}`);

    // Revoke Device B
    section('Revoking Device B');
    log(`Revoking device: ${pairB.deviceId}`);
    const revoked = await client.revokeDevice(pairB.deviceId);
    success(`Device B revoked at: ${revoked.revokedAt}`);

    // Show devices after revocation
    section('After Revocation');
    const devicesAfter = await client.listDevices();
    console.log(chalk.white('Current devices:'));
    devicesAfter.forEach(d => {
      const status = d.revokedAt ? chalk.red('REVOKED') : chalk.green(d.trustStatus);
      console.log(`  - ${d.deviceName} (${d.platform}): ${status}`);
      if (d.revokedAt) {
        console.log(`    Revoked at: ${d.revokedAt}`);
      }
    });

    // Test 2: Try to create task with revoked device (should fail)
    section('Test 2: Try to Create Task With Revoked Device');
    log('Attempting to create transfer task to revoked Device B...');
    try {
      const task2 = await client.createTask(
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
      error('UNEXPECTED: Task was created with revoked device!');
      console.log(chalk.red(`  Task ID: ${task2.taskId}`));
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        success('Task creation correctly rejected!');
        console.log(`  Error message: ${err.response.data.message}`);
      } else {
        error(`Unexpected error: ${err.message}`);
      }
    }

    // Test 3: Try with revoked source device
    section('Test 3: Try to Create Task From Revoked Device');
    log('Attempting to create transfer task from revoked Device B...');
    try {
      const task3 = await client.createTask(
        pairB.deviceId,
        pairA.deviceId,
        'transfer_file',
        {
          sourcePath: '/tmp/source-b.txt',
          targetPath: '/tmp/dest-a.txt',
          expectedDigest: testDigest,
          expectedByteCount: testByteCount,
        }
      );
      error('UNEXPECTED: Task was created with revoked source device!');
      console.log(chalk.red(`  Task ID: ${task3.taskId}`));
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        success('Task creation correctly rejected!');
        console.log(`  Error message: ${err.response.data.message}`);
      } else {
        error(`Unexpected error: ${err.message}`);
      }
    }

    section('✅ Revocation Demo Complete');
    console.log(chalk.green.bold('\nDevice revocation enforcement demonstrated!\n'));
    info('Key findings:');
    console.log('  ✓ Tasks can be created before device revocation');
    console.log('  ✓ Revoked devices cannot be used as target');
    console.log('  ✓ Revoked devices cannot be used as source');
    console.log('  ✓ Revocation is enforced at task creation time\n');

  } catch (err: any) {
    error(`Error during revocation demo: ${err.message}`);
    if (err.response) {
      console.log(chalk.red('Response:'), JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the demo
runRevokeDemo();
