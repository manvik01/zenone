#!/usr/bin/env ts-node

import { ZenClient } from './zen-client';
import { 
  prompt, 
  success, 
  error, 
  log, 
  showMenu, 
  closeReadline,
  sanitizeToken 
} from './cli-helpers';
import * as handlers from './cli-handlers';
import chalk from 'chalk';

const BASE_URL = process.env.ZENCONNECT_URL || 'http://localhost:3000';
const client = new ZenClient({ baseUrl: BASE_URL });

let currentDeviceId: string | null = null;

async function handleRegister(): Promise<void> {
  const email = await prompt('Email: ');
  const password = await prompt('Password: ');
  
  if (!email || !password) {
    error('Email and password are required');
    return;
  }
  
  try {
    const result = await client.register(email, password);
    success(`Registered user: ${result.userId}`);
    log(`Verification token: ${sanitizeToken(result.verificationToken)}`);
    
    await client.verifyEmail(result.verificationToken);
    success('Email verified automatically');
  } catch (err: any) {
    error(`Registration failed: ${err.response?.data?.message || err.message}`);
  }
}

async function handlePairDevice(): Promise<void> {
  const deviceId = await handlers.handlePairDevice(client, 'Device-A', 'ANDROID');
  if (deviceId) {
    currentDeviceId = deviceId;
  }
}

const commands = [
  '1. Register',
  '2. Login',
  '3. Pair Device',
  '4. List Devices',
  '5. Create Grant',
  '6. List Grants',
  '7. Create Transfer Task',
  '8. Approve Task',
  '9. Execute Task',
  '10. List Tasks',
  '11. Get Task Status',
  '12. Revoke Device',
  '13. Update Presence',
  '0. Exit',
];

async function processCommand(choice: string): Promise<boolean> {
  switch (choice) {
    case '1':
      await handleRegister();
      return true;
    case '2':
      await handlers.handleLogin(client);
      return true;
    case '3':
      await handlePairDevice();
      return true;
    case '4':
      await handlers.handleListDevices(client);
      return true;
    case '5':
      await handlers.handleCreateGrant(client);
      return true;
    case '6':
      await handlers.handleListGrants(client);
      return true;
    case '7':
      await handlers.handleCreateTask(client);
      return true;
    case '8':
      await handlers.handleApproveTask(client);
      return true;
    case '9':
      await handlers.handleExecuteTask(client);
      return true;
    case '10':
      await handlers.handleListTasks(client);
      return true;
    case '11':
      await handlers.handleGetTaskStatus(client);
      return true;
    case '12':
      await handlers.handleRevokeDevice(client);
      return true;
    case '13':
      await handlers.handleUpdatePresence(client, currentDeviceId);
      return true;
    case '0':
      console.log(chalk.yellow('\nGoodbye!\n'));
      closeReadline();
      process.exit(0);
    default:
      error('Invalid choice');
      return true;
  }
}

async function runMenu(): Promise<void> {
  showMenu('Device A', commands);
  const choice = await prompt('Choose a command: ');
  const shouldContinue = await processCommand(choice);
  
  if (shouldContinue) {
    setImmediate(() => { runMenu().catch(handleError); });
  }
}

function handleError(err: Error): void {
  error(`Fatal error: ${err.message}`);
  closeReadline();
  process.exit(1);
}

async function main(): Promise<void> {
  console.log(chalk.bold.green('\n🚀 ZenOne Device A CLI\n'));
  console.log(chalk.gray(`Server: ${BASE_URL}\n`));
  await runMenu();
}

main().catch(handleError);
