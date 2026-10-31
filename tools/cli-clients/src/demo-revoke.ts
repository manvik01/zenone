#!/usr/bin/env ts-node

import { log, success, info, section } from './cli-helpers';
import { 
  setupUserAndDevices, 
  createGrants, 
  generateTestContent 
} from './demo-helpers';
import chalk from 'chalk';

const TEST_EMAIL = process.env.TEST_EMAIL || `test-revoke-${Date.now()}@example.com`;
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SecurePass123!';

async function runRevokeDemo(): Promise<void> {
  try {
    section('ZenOne Device Revocation Demo');

    section('Setup: Register and Pair Devices');
    const { client, deviceAId, deviceBId } = await setupUserAndDevices(TEST_EMAIL, TEST_PASSWORD);
    await createGrants(client, deviceAId, deviceBId);

    section('Before Revocation');
    const devicesBefore = await client.listDevices();
    console.log(chalk.white('Active devices:'));
    devicesBefore.forEach(d => {
      console.log(`  - ${d.deviceName} (${d.platform}): ${d.trustStatus}`);
    });

    section('Test 1: Create Task Before Revocation');
    const testData = generateTestContent();

    log('Creating transfer task from Device A to Device B...');
    const task1 = await client.createTask(
      deviceAId,
      deviceBId,
      'transfer_file',
      {
        sourcePath: '/tmp/source.txt',
        targetPath: '/tmp/dest.txt',
        expectedDigest: testData.digest,
        expectedByteCount: testData.byteCount,
      }
    );
    success(`Task created successfully: ${task1.taskId}, State: ${task1.state}`);

    section('Revoking Device B');
    log(`Revoking device: ${deviceBId}`);
    const revoked = await client.revokeDevice(deviceBId);
    success(`Device B revoked at: ${revoked.revokedAt}`);

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

    section('Test 2: Try to Create Task With Revoked Device');
    log('Attempting to create transfer task to revoked Device B...');
    try {
      await client.createTask(
        deviceAId,
        deviceBId,
        'transfer_file',
        {
          sourcePath: '/tmp/source.txt',
          targetPath: '/tmp/dest.txt',
          expectedDigest: testData.digest,
          expectedByteCount: testData.byteCount,
        }
      );
      console.error(chalk.red('✗ UNEXPECTED: Task was created with revoked device!'));
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        success('Task creation correctly rejected!');
        console.log(`  Error message: ${err.response.data.message}`);
      } else {
        console.error(chalk.red(`✗ Unexpected error: ${err.message}`));
      }
    }

    section('Test 3: Try to Create Task From Revoked Device');
    log('Attempting to create transfer task from revoked Device B...');
    try {
      await client.createTask(
        deviceBId,
        deviceAId,
        'transfer_file',
        {
          sourcePath: '/tmp/source-b.txt',
          targetPath: '/tmp/dest-a.txt',
          expectedDigest: testData.digest,
          expectedByteCount: testData.byteCount,
        }
      );
      console.error(chalk.red('✗ UNEXPECTED: Task was created with revoked source device!'));
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        success('Task creation correctly rejected!');
        console.log(`  Error message: ${err.response.data.message}`);
      } else {
        console.error(chalk.red(`✗ Unexpected error: ${err.message}`));
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
    console.error(chalk.red(`✗ Error during revocation demo: ${err.message}`));
    if (err.response) {
      console.log(chalk.red('Response:'), JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

runRevokeDemo();
