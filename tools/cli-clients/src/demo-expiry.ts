#!/usr/bin/env ts-node

import { log, success, section, wait } from './cli-helpers';
import { 
  setupUserAndDevices, 
  createGrants, 
  generateTestContent 
} from './demo-helpers';
import chalk from 'chalk';

const TEST_EMAIL = process.env.TEST_EMAIL || `test-expiry-${Date.now()}@example.com`;
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'SecurePass123!';

async function runExpiryDemo(): Promise<void> {
  try {
    section('ZenOne Task Expiry Demo');

    section('Setup: Register and Pair Devices');
    const { client, deviceAId, deviceBId } = await setupUserAndDevices(TEST_EMAIL, TEST_PASSWORD);

    await createGrants(client, deviceAId, deviceBId);

    section('Scenario: Task Expiry');
    const testData = generateTestContent();

    log('Creating task that will expire (default expiry is short)...');
    const task = await client.createTask(
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
    success(`Task created: ${task.taskId}, State: ${task.state}`);
    console.log(`  Expires at: ${task.expiresAt}`);

    log('Waiting for task to expire (checking periodically)...');
    
    let currentState = task.state;
    let attempts = 0;
    const maxAttempts = 12;
    
    while (currentState !== 'EXPIRED' && attempts < maxAttempts) {
      await wait(5000);
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
    console.error(chalk.red(`✗ Error during expiry demo: ${err.message}`));
    if (err.response) {
      console.log(chalk.red('Response:'), JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

runExpiryDemo();
