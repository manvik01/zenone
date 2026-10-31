#!/usr/bin/env ts-node

import { ZenClient } from './zen-client';
import { 
  prompt, 
  error, 
  showMenu, 
  closeReadline 
} from './cli-helpers';
import * as handlers from './cli-handlers';
import chalk from 'chalk';

const BASE_URL = process.env.ZENCONNECT_URL || 'http://localhost:3000';
const client = new ZenClient({ baseUrl: BASE_URL });

let currentDeviceId: string | null = null;

async function handlePairDevice(): Promise<void> {
  const deviceId = await handlers.handlePairDevice(client, 'Device-B', 'WINDOWS');
  if (deviceId) {
    currentDeviceId = deviceId;
  }
}

const commands = [
  '1. Login',
  '2. Pair Device',
  '3. List Devices',
  '4. Create Grant',
  '5. List Grants',
  '6. Create Transfer Task',
  '7. Approve Task',
  '8. Execute Task',
  '9. List Tasks',
  '10. Get Task Status',
  '11. Update Presence',
  '0. Exit',
];

async function processCommand(choice: string): Promise<boolean> {
  switch (choice) {
    case '1':
      await handlers.handleLogin(client);
      return true;
    case '2':
      await handlePairDevice();
      return true;
    case '3':
      await handlers.handleListDevices(client);
      return true;
    case '4':
      await handlers.handleCreateGrant(client);
      return true;
    case '5':
      await handlers.handleListGrants(client);
      return true;
    case '6':
      await handlers.handleCreateTask(client);
      return true;
    case '7':
      await handlers.handleApproveTask(client);
      return true;
    case '8':
      await handlers.handleExecuteTask(client);
      return true;
    case '9':
      await handlers.handleListTasks(client);
      return true;
    case '10':
      await handlers.handleGetTaskStatus(client);
      return true;
    case '11':
      await handlers.handleUpdatePresence(client, currentDeviceId);
      return true;
    case '0':
      console.log(chalk.magenta('\nGoodbye!\n'));
      closeReadline();
      process.exit(0);
    default:
      error('Invalid choice');
      return true;
  }
}

async function runMenu(): Promise<void> {
  showMenu('Device B', commands);
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
  console.log(chalk.bold.magenta('\n🚀 ZenOne Device B CLI\n'));
  console.log(chalk.gray(`Server: ${BASE_URL}\n`));
  await runMenu();
}

main().catch(handleError);
