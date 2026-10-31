import { ZenClient } from './zen-client';
import { prompt, log, success, error, sanitizeToken, sanitizeLog } from './cli-helpers';
import chalk from 'chalk';

export async function handleLogin(client: ZenClient): Promise<void> {
  const email = await prompt('Email: ');
  const password = await prompt('Password: ');
  
  if (!email || !password) {
    error('Email and password are required');
    return;
  }
  
  try {
    const session = await client.login(email, password);
    success('Logged in successfully');
    log(`Access token: ${sanitizeToken(session.accessToken)}`);
  } catch (err: any) {
    error(`Login failed: ${err.response?.data?.message || err.message}`);
  }
}

export async function handlePairDevice(
  client: ZenClient, 
  defaultName: string, 
  defaultPlatform: string
): Promise<string | null> {
  const deviceName = await prompt(`Device Name (default: ${defaultName}): `) || defaultName;
  const platform = await prompt(`Platform (ANDROID/WINDOWS, default: ${defaultPlatform}): `) || defaultPlatform;
  
  try {
    const pairStart = await client.startPairing(deviceName, platform, ['transfer', 'summarize']);
    success(`Pairing started for device: ${pairStart.deviceId}`);
    log(`Pairing code: ${pairStart.pairingCode}`);
    log(`Expires at: ${pairStart.expiresAt}`);
    
    const device = await client.confirmPairing(pairStart.deviceId, pairStart.pairingCode);
    success('Device paired successfully');
    log(`Device ID: ${device.deviceId}`);
    return device.deviceId;
  } catch (err: any) {
    error(`Pairing failed: ${err.response?.data?.message || err.message}`);
    return null;
  }
}

export async function handleListDevices(client: ZenClient): Promise<void> {
  try {
    const devices = await client.listDevices();
    success(`Found ${devices.length} devices:`);
    devices.forEach((d, i) => {
      console.log(`\n  ${i + 1}. ${sanitizeLog(d.deviceName)} (${sanitizeLog(d.platform)})`);
      console.log(`     Device ID: ${sanitizeLog(d.deviceId)}`);
      console.log(`     Status: ${sanitizeLog(d.trustStatus)}, Online: ${d.isOnline}`);
      console.log(`     Capabilities: ${d.capabilities.map(c => sanitizeLog(c)).join(', ')}`);
      if (d.revokedAt) {
        console.log(chalk.red(`     Revoked at: ${sanitizeLog(String(d.revokedAt))}`));
      }
    });
  } catch (err: any) {
    error(`Failed to list devices: ${err.response?.data?.message || err.message}`);
  }
}

export async function handleCreateGrant(client: ZenClient): Promise<void> {
  const deviceId = await prompt('Device ID: ');
  const resourceType = await prompt('Resource Type (file_path/folder_path, default: file_path): ') || 'file_path';
  const resourcePath = await prompt('Resource Path: ');
  const capabilities = await prompt('Capabilities (comma-separated, default: transfer): ') || 'transfer';
  
  if (!deviceId || !resourcePath) {
    error('Device ID and resource path are required');
    return;
  }
  
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

export async function handleListGrants(client: ZenClient): Promise<void> {
  try {
    const grants = await client.listGrants();
    success(`Found ${grants.length} grants:`);
    grants.forEach((g, i) => {
      console.log(`\n  ${i + 1}. Grant ${sanitizeLog(g.grantId)}`);
      console.log(`     Device: ${sanitizeLog(g.deviceId)}`);
      console.log(`     Resource: ${sanitizeLog(g.resourceType)} - ${sanitizeLog(g.resourcePath)}`);
      console.log(`     Capabilities: ${g.capabilities.map(c => sanitizeLog(c)).join(', ')}`);
      if (g.revokedAt) {
        console.log(chalk.red(`     Revoked at: ${sanitizeLog(String(g.revokedAt))}`));
      }
    });
  } catch (err: any) {
    error(`Failed to list grants: ${err.response?.data?.message || err.message}`);
  }
}

export async function handleCreateTask(client: ZenClient): Promise<void> {
  const sourceDeviceId = await prompt('Source Device ID: ');
  const targetDeviceId = await prompt('Target Device ID: ');
  const sourcePath = await prompt('Source Path: ');
  const targetPath = await prompt('Target Path: ');
  const digest = await prompt('Expected Digest (SHA-256): ');
  const byteCountStr = await prompt('Expected Byte Count: ');
  
  if (!sourceDeviceId || !targetDeviceId || !sourcePath || !targetPath || !digest || !byteCountStr) {
    error('All fields are required');
    return;
  }
  
  const byteCount = Number.parseInt(byteCountStr, 10);
  if (Number.isNaN(byteCount) || byteCount < 0) {
    error('Byte count must be a non-negative number');
    return;
  }
  
  try {
    const task = await client.createTask(
      sourceDeviceId,
      targetDeviceId,
      'transfer_file',
      {
        sourcePath,
        targetPath,
        expectedDigest: digest,
        expectedByteCount: byteCount,
      }
    );
    success(`Task created: ${task.taskId}`);
    log(`State: ${task.state}`);
    log(`Expires at: ${task.expiresAt}`);
  } catch (err: any) {
    error(`Failed to create task: ${err.response?.data?.message || err.message}`);
  }
}

export async function handleApproveTask(client: ZenClient): Promise<void> {
  const taskId = await prompt('Task ID: ');
  
  if (!taskId) {
    error('Task ID is required');
    return;
  }
  
  try {
    const task = await client.approveTask(taskId);
    success(`Task approved: ${task.taskId}`);
    log(`State: ${task.state}`);
    log(`Approved at: ${task.approvedAt || 'N/A'}`);
  } catch (err: any) {
    error(`Failed to approve task: ${err.response?.data?.message || err.message}`);
  }
}

export async function handleExecuteTask(client: ZenClient): Promise<void> {
  const taskId = await prompt('Task ID: ');
  
  if (!taskId) {
    error('Task ID is required');
    return;
  }
  
  try {
    const task = await client.executeTask(taskId);
    success(`Task executed: ${task.taskId}`);
    log(`State: ${task.state}`);
    
    if (task.state === 'SUCCEEDED' && task.transferResult) {
      console.log('  Transfer Result:');
      console.log(`    Actual digest: ${sanitizeLog(task.transferResult.actualDigest || 'N/A')}`);
      console.log(`    Actual bytes: ${task.transferResult.actualByteCount || 'N/A'}`);
      console.log(`    Source grant checked: ${task.transferResult.sourceGrantChecked}`);
      console.log(`    Target grant checked: ${task.transferResult.targetGrantChecked}`);
    } else if (task.state === 'FAILED') {
      error(`Failure reason: ${task.failureReason || 'Unknown'}`);
    }
  } catch (err: any) {
    error(`Failed to execute task: ${err.response?.data?.message || err.message}`);
  }
}

export async function handleListTasks(client: ZenClient): Promise<void> {
  try {
    const tasks = await client.listTasks();
    success(`Found ${tasks.length} tasks:`);
    tasks.forEach((t, i) => {
      console.log(`\n  ${i + 1}. Task ${sanitizeLog(t.taskId)}`);
      console.log(`     Action: ${sanitizeLog(t.actionType)}`);
      console.log(`     State: ${sanitizeLog(t.state)}`);
      console.log(`     Source: ${sanitizeLog(t.sourceDeviceId)}`);
      console.log(`     Target: ${sanitizeLog(t.targetDeviceId)}`);
      console.log(`     Created: ${sanitizeLog(String(t.createdAt))}`);
    });
  } catch (err: any) {
    error(`Failed to list tasks: ${err.response?.data?.message || err.message}`);
  }
}

export async function handleGetTaskStatus(client: ZenClient): Promise<void> {
  const taskId = await prompt('Task ID: ');
  
  if (!taskId) {
    error('Task ID is required');
    return;
  }
  
  try {
    const status = await client.getTaskStatus(taskId);
    success(`Task ${status.taskId}:`);
    log(`State: ${status.state}`);
    log(`Updated at: ${status.updatedAt}`);
  } catch (err: any) {
    error(`Failed to get task status: ${err.response?.data?.message || err.message}`);
  }
}

export async function handleRevokeDevice(client: ZenClient): Promise<void> {
  const deviceId = await prompt('Device ID to revoke: ');
  
  if (!deviceId) {
    error('Device ID is required');
    return;
  }
  
  try {
    const result = await client.revokeDevice(deviceId);
    success(`Device revoked: ${result.deviceId}`);
    log(`Revoked at: ${result.revokedAt}`);
  } catch (err: any) {
    error(`Failed to revoke device: ${err.response?.data?.message || err.message}`);
  }
}

export async function handleUpdatePresence(client: ZenClient, currentDeviceId: string | null): Promise<void> {
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
