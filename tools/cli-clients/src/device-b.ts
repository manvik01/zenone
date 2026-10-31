#!/usr/bin/env ts-node

import { ZenClient } from './zen-client';
import * as readline from 'readline';
import chalk from 'chalk';

const BASE_URL = process.env.ZENCONNECT_URL || 'http://localhost:3000';
const client = new ZenClient({ baseUrl: BASE_URL });

let currentDeviceId: string | null = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.cyan(question), (answer) => {
      resolve(answer.trim());
    });
  });
}

function log(message: string) {
  console.log(chalk.blue('→'), message);
}

function success(message: string) {
  console.log(chalk.green('✓'), message);
}

function error(message: string) {
  console.log(chalk.red('✗'), message);
}

function showMenu() {
  console.log('\n' + chalk.bold.magenta('='.repeat(50)));
  console.log(chalk.bold.magenta('  Device B - Interactive CLI'));
  console.log(chalk.bold.magenta('='.repeat(50)));
  console.log('\n' + chalk.bold('Available Commands:'));
  console.log('  1. Login');
  console.log('  2. Pair Device');
  console.log('  3. List Devices');
  console.log('  4. Create Grant');
  console.log('  5. List Grants');
  console.log('  6. Create Transfer Task');
  console.log('  7. Approve Task');
  console.log('  8. Execute Task');
  console.log('  9. List Tasks');
  console.log('  10. Get Task Status');
  console.log('  11. Update Presence');
  console.log('  0. Exit');
  console.log('');
}

async function handleLogin() {
  const email = await prompt('Email: ');
  const password = await prompt('Password: ');
  
  try {
    const session = await client.login(email, password);
    success('Logged in successfully');
    log(`Access token: ${session.accessToken.substring(0, 30)}...`);
  } catch (err: any) {
    error(`Login failed: ${err.response?.data?.message || err.message}`);
  }
}

async function handlePairDevice() {
  const deviceName = await prompt('Device Name (default: Device-B): ') || 'Device-B';
  const platform = await prompt('Platform (ANDROID/WINDOWS, default: WINDOWS): ') || 'WINDOWS';
  
  try {
    const pairStart = await client.startPairing(deviceName, platform, ['transfer', 'summarize']);
    success(`Pairing started for device: ${pairStart.deviceId}`);
    log(`Pairing code: ${pairStart.pairingCode}`);
    log(`Expires at: ${pairStart.expiresAt}`);
    
    // Auto-confirm
    const device = await client.confirmPairing(pairStart.deviceId, pairStart.pairingCode);
    success('Device paired successfully');
    currentDeviceId = device.deviceId;
    log(`Device ID: ${device.deviceId}`);
  } catch (err: any) {
    error(`Pairing failed: ${err.response?.data?.message || err.message}`);
  }
}

async function handleListDevices() {
  try {
    const devices = await client.listDevices();
    success(`Found ${devices.length} devices:`);
    devices.forEach((d, i) => {
      console.log(`\n  ${i + 1}. ${d.deviceName} (${d.platform})`);
      console.log(`     Device ID: ${d.deviceId}`);
      console.log(`     Status: ${d.trustStatus}, Online: ${d.isOnline}`);
      console.log(`     Capabilities: ${d.capabilities.join(', ')}`);
      if (d.revokedAt) {
        console.log(chalk.red(`     Revoked at: ${d.revokedAt}`));
      }
    });
  } catch (err: any) {
    error(`Failed to list devices: ${err.response?.data?.message || err.message}`);
  }
}

async function handleCreateGrant() {
  const deviceId = await prompt('Device ID: ');
  const resourceType = await prompt('Resource Type (file_path/folder_path, default: file_path): ') || 'file_path';
  const resourcePath = await prompt('Resource Path: ');
  const capabilities = await prompt('Capabilities (comma-separated, default: transfer): ') || 'transfer';
  
  try {
    const grant = await client.createGrant(
      deviceId,
      resourceType,
      resourcePath,
      capabilities.split(',').map(c => c.trim())
    );
    success(`Grant created: ${grant.grantId}`);
    log(`Device: ${grant.deviceId}`);
    log(`Path: ${grant.resourcePath}`);
    log(`Capabilities: ${grant.capabilities.join(', ')}`);
  } catch (err: any) {
    error(`Failed to create grant: ${err.response?.data?.message || err.message}`);
  }
}

async function handleListGrants() {
  try {
    const grants = await client.listGrants();
    success(`Found ${grants.length} grants:`);
    grants.forEach((g, i) => {
      console.log(`\n  ${i + 1}. Grant ${g.grantId}`);
      console.log(`     Device: ${g.deviceId}`);
      console.log(`     Resource: ${g.resourceType} - ${g.resourcePath}`);
      console.log(`     Capabilities: ${g.capabilities.join(', ')}`);
      if (g.revokedAt) {
        console.log(chalk.red(`     Revoked at: ${g.revokedAt}`));
      }
    });
  } catch (err: any) {
    error(`Failed to list grants: ${err.response?.data?.message || err.message}`);
  }
}

async function handleCreateTask() {
  const sourceDeviceId = await prompt('Source Device ID: ');
  const targetDeviceId = await prompt('Target Device ID: ');
  const sourcePath = await prompt('Source Path: ');
  const targetPath = await prompt('Target Path: ');
  const digest = await prompt('Expected Digest (SHA-256): ');
  const byteCount = await prompt('Expected Byte Count: ');
  
  try {
    const task = await client.createTask(
      sourceDeviceId,
      targetDeviceId,
      'transfer_file',
      {
        sourcePath,
        targetPath,
        expectedDigest: digest,
        expectedByteCount: parseInt(byteCount),
      }
    );
    success(`Task created: ${task.taskId}`);
    log(`State: ${task.state}`);
    log(`Expires at: ${task.expiresAt}`);
  } catch (err: any) {
    error(`Failed to create task: ${err.response?.data?.message || err.message}`);
  }
}

async function handleApproveTask() {
  const taskId = await prompt('Task ID: ');
  
  try {
    const task = await client.approveTask(taskId);
    success(`Task approved: ${task.taskId}`);
    log(`State: ${task.state}`);
    log(`Approved at: ${task.approvedAt}`);
  } catch (err: any) {
    error(`Failed to approve task: ${err.response?.data?.message || err.message}`);
  }
}

async function handleExecuteTask() {
  const taskId = await prompt('Task ID: ');
  
  try {
    const task = await client.executeTask(taskId);
    success(`Task executed: ${task.taskId}`);
    log(`State: ${task.state}`);
    
    if (task.state === 'SUCCEEDED') {
      console.log('  Transfer Result:');
      console.log(`    Actual digest: ${task.transferResult?.actualDigest}`);
      console.log(`    Actual bytes: ${task.transferResult?.actualByteCount}`);
      console.log(`    Source grant checked: ${task.transferResult?.sourceGrantChecked}`);
      console.log(`    Target grant checked: ${task.transferResult?.targetGrantChecked}`);
    } else if (task.state === 'FAILED') {
      error(`Failure reason: ${task.failureReason}`);
    }
  } catch (err: any) {
    error(`Failed to execute task: ${err.response?.data?.message || err.message}`);
  }
}

async function handleListTasks() {
  try {
    const tasks = await client.listTasks();
    success(`Found ${tasks.length} tasks:`);
    tasks.forEach((t, i) => {
      console.log(`\n  ${i + 1}. Task ${t.taskId}`);
      console.log(`     Action: ${t.actionType}`);
      console.log(`     State: ${t.state}`);
      console.log(`     Source: ${t.sourceDeviceId}`);
      console.log(`     Target: ${t.targetDeviceId}`);
      console.log(`     Created: ${t.createdAt}`);
    });
  } catch (err: any) {
    error(`Failed to list tasks: ${err.response?.data?.message || err.message}`);
  }
}

async function handleGetTaskStatus() {
  const taskId = await prompt('Task ID: ');
  
  try {
    const status = await client.getTaskStatus(taskId);
    success(`Task ${status.taskId}:`);
    log(`State: ${status.state}`);
    log(`Updated at: ${status.updatedAt}`);
  } catch (err: any) {
    error(`Failed to get task status: ${err.response?.data?.message || err.message}`);
  }
}

async function handleUpdatePresence() {
  const deviceId = await prompt(`Device ID (default: ${currentDeviceId || 'none'}): `) || currentDeviceId;
  
  if (!deviceId) {
    error('No device ID provided and no current device set');
    return;
  }
  
  try {
    const result = await client.updatePresence(deviceId);
    success(`Presence updated for device: ${result.deviceId}`);
    log(`Last seen: ${result.lastSeen}`);
    log(`Online: ${result.isOnline}`);
  } catch (err: any) {
    error(`Failed to update presence: ${err.response?.data?.message || err.message}`);
  }
}

async function main() {
  console.log(chalk.bold.magenta('\n🚀 ZenOne Device B CLI\n'));
  console.log(chalk.gray(`Server: ${BASE_URL}\n`));

  while (true) {
    showMenu();
    const choice = await prompt('Choose a command: ');

    switch (choice) {
      case '1':
        await handleLogin();
        break;
      case '2':
        await handlePairDevice();
        break;
      case '3':
        await handleListDevices();
        break;
      case '4':
        await handleCreateGrant();
        break;
      case '5':
        await handleListGrants();
        break;
      case '6':
        await handleCreateTask();
        break;
      case '7':
        await handleApproveTask();
        break;
      case '8':
        await handleExecuteTask();
        break;
      case '9':
        await handleListTasks();
        break;
      case '10':
        await handleGetTaskStatus();
        break;
      case '11':
        await handleUpdatePresence();
        break;
      case '0':
        console.log(chalk.magenta('\nGoodbye!\n'));
        rl.close();
        process.exit(0);
      default:
        error('Invalid choice');
    }
  }
}

main();
