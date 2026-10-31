import { ZenClient } from './zen-client';
import { log, success, section, sanitizeToken } from './cli-helpers';
import * as crypto from 'crypto';

export interface SetupResult {
  client: ZenClient;
  userId: string;
  deviceAId: string;
  deviceBId: string;
}

export async function setupUserAndDevices(
  email: string,
  password: string
): Promise<SetupResult> {
  const clientA = new ZenClient({ 
    baseUrl: process.env.ZENCONNECT_URL || 'http://localhost:3000' 
  });
  
  log(`Registering user: ${email}`);
  const registration = await clientA.register(email, password);
  success(`User registered: ${registration.userId}`);
  
  log(`Verifying email with token: ${sanitizeToken(registration.verificationToken)}`);
  await clientA.verifyEmail(registration.verificationToken);
  success('Email verified');
  
  log('Logging in...');
  await clientA.login(email, password);
  success('User logged in');
  
  log('Pairing Device A...');
  const pairA = await clientA.startPairing('Device-A', 'ANDROID', ['transfer', 'summarize']);
  await clientA.confirmPairing(pairA.deviceId, pairA.pairingCode);
  success(`Device A paired: ${pairA.deviceId}`);
  
  log('Pairing Device B...');
  const pairB = await clientA.startPairing('Device-B', 'WINDOWS', ['transfer', 'summarize']);
  await clientA.confirmPairing(pairB.deviceId, pairB.pairingCode);
  success(`Device B paired: ${pairB.deviceId}`);
  
  return {
    client: clientA,
    userId: registration.userId,
    deviceAId: pairA.deviceId,
    deviceBId: pairB.deviceId,
  };
}

export async function createGrants(
  client: ZenClient,
  deviceAId: string,
  deviceBId: string
): Promise<void> {
  await client.createGrant(deviceAId, 'file_path', '/tmp/source.txt', ['transfer']);
  await client.createGrant(deviceBId, 'file_path', '/tmp/dest.txt', ['transfer']);
  success('Grants created for both devices');
}

export interface TestContent {
  content: string;
  digest: string;
  byteCount: number;
}

export function generateTestContent(): TestContent {
  const content = 'Hello from ZenOne!';
  const digest = crypto.createHash('sha256').update(content).digest('hex');
  const byteCount = Buffer.byteLength(content);
  
  return { content, digest, byteCount };
}

export async function createAndApproveTask(
  client: ZenClient,
  sourceDeviceId: string,
  targetDeviceId: string,
  testData: TestContent
): Promise<any> {
  const task = await client.createTask(
    sourceDeviceId,
    targetDeviceId,
    'transfer_file',
    {
      sourcePath: '/tmp/source.txt',
      targetPath: '/tmp/dest.txt',
      expectedDigest: testData.digest,
      expectedByteCount: testData.byteCount,
    }
  );
  
  success(`Task created: ${task.taskId}, State: ${task.state}`);
  
  const approved = await client.approveTask(task.taskId);
  success(`Task approved: ${approved.state}`);
  
  return approved;
}

export function displayTaskResult(task: any): void {
  section(`Task Status: ${task.state}`);
  
  if (task.state === 'SUCCEEDED' && task.transferResult) {
    console.log('  Transfer Result:');
    console.log(`    - Actual digest: ${task.transferResult.actualDigest || 'N/A'}`);
    console.log(`    - Actual bytes: ${task.transferResult.actualByteCount || 'N/A'}`);
    console.log(`    - Source grant checked: ${task.transferResult.sourceGrantChecked}`);
    console.log(`    - Target grant checked: ${task.transferResult.targetGrantChecked}`);
  } else if (task.state === 'FAILED') {
    console.log(`  Failure reason: ${task.failureReason || 'Unknown'}`);
  }
}
