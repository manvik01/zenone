import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransferExecutionService } from './transfer-execution.service';
import { TasksService } from '../tasks/tasks.service';
import { GrantsService } from '../zencontrol/grants.service';
import { AuditService } from '../zencontrol/audit.service';
import { DevicesService } from '../devices/devices.service';
import { TaskValidationService } from '../tasks/task-validation.service';
import { Task, TaskState, ActionType } from '../common/dto/task.dto';
import { ResourceType, Capability, AuditResult } from '../common/dto/zencontrol.dto';
import { TrustStatus, Platform } from '../common/dto/device.dto';

// Mock uuid to return predictable but unique IDs
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `mock-uuid-${++uuidCounter}`),
}));

describe('TransferExecutionService', () => {
  let service: TransferExecutionService;
  let tasksService: TasksService;
  let grantsService: GrantsService;
  let auditService: AuditService;
  let devicesService: DevicesService;

  const userId = 'user-1';
  const sourceDeviceId = 'device-source';
  const targetDeviceId = 'device-target';
  const sourcePath = '/home/user/documents/file.txt';
  const targetPath = '/home/user/backup/file.txt';
  const expectedDigest = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // SHA-256 of empty string
  const expectedByteCount = 1024;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferExecutionService,
        TasksService,
        GrantsService,
        AuditService,
        DevicesService,
        TaskValidationService,
      ],
    }).compile();

    service = module.get<TransferExecutionService>(TransferExecutionService);
    tasksService = module.get<TasksService>(TasksService);
    grantsService = module.get<GrantsService>(GrantsService);
    auditService = module.get<AuditService>(AuditService);
    devicesService = module.get<DevicesService>(DevicesService);

    // Setup devices - mock findById for GrantsService
    const sourceDevice = {
      deviceId: sourceDeviceId,
      userId,
      platform: Platform.ANDROID,
      deviceName: 'Source Device',
      publicKey: 'source-key',
      capabilities: ['file_transfer'],
      lastSeen: new Date(),
      trustStatus: TrustStatus.TRUSTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const targetDevice = {
      deviceId: targetDeviceId,
      userId,
      platform: Platform.WINDOWS,
      deviceName: 'Target Device',
      publicKey: 'target-key',
      capabilities: ['file_transfer'],
      lastSeen: new Date(),
      trustStatus: TrustStatus.TRUSTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store devices for TaskValidationService
    devicesService['devices'].set(sourceDeviceId, sourceDevice);
    devicesService['devices'].set(targetDeviceId, targetDevice);

    // Mock findById for both source and target devices
    jest.spyOn(devicesService, 'findById').mockImplementation((deviceId: string) => {
      if (deviceId === sourceDeviceId) return sourceDevice;
      if (deviceId === targetDeviceId) return targetDevice;
      return null;
    });
  });

  describe('executeTransfer - Success Path', () => {
    it('should successfully complete transfer with valid grants and matching digest/bytes', async () => {
      // Create grants for both source and target paths
      const sourceGrant = grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
      });

      const targetGrant = grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });

      // Create and approve task
      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {
          sourcePath,
          targetPath,
          expectedDigest,
          expectedByteCount,
        },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      // Execute transfer
      const result = await service.executeTransfer(approvedTask.taskId);

      // Verify task state
      const completedTask = tasksService.findById(task.taskId);
      expect(completedTask.state).toBe(TaskState.SUCCEEDED);
      expect(completedTask.completedAt).toBeDefined();
      expect(completedTask.transferResult).toBeDefined();
      expect(completedTask.transferResult.actualDigest).toBe(expectedDigest);
      expect(completedTask.transferResult.actualByteCount).toBe(expectedByteCount);
      expect(completedTask.transferResult.sourceGrantChecked).toBe(true);
      expect(completedTask.transferResult.targetGrantChecked).toBe(true);
      expect(completedTask.transferResult.error).toBeUndefined();

      // Verify audit trail
      const auditEntries = auditService.query({ userId });
      expect(auditEntries.length).toBeGreaterThanOrEqual(2); // At least source and target grant checks
      
      const sourceAudit = auditEntries.find(
        e => e.deviceId === sourceDeviceId && e.resourcePath === sourcePath
      );
      expect(sourceAudit).toBeDefined();
      expect(sourceAudit.result).toBe(AuditResult.GRANTED);

      const targetAudit = auditEntries.find(
        e => e.deviceId === targetDeviceId && e.resourcePath === targetPath
      );
      expect(targetAudit).toBeDefined();
      expect(targetAudit.result).toBe(AuditResult.GRANTED);
    });
  });

  describe('executeTransfer - ACL Failures', () => {
    it('should fail when no grant for source path', async () => {
      // Only create target grant, not source
      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toContain('Access denied');
      expect(failedTask.failureReason).toContain('source');
      expect(failedTask.transferResult.error).toBeDefined();

      // Verify audit recorded the denial
      const auditEntries = auditService.query({ deviceId: sourceDeviceId });
      const deniedEntry = auditEntries.find(e => e.result === AuditResult.DENIED);
      expect(deniedEntry).toBeDefined();
    });

    it('should fail when no grant for target path', async () => {
      // Only create source grant, not target
      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
      });

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toContain('Access denied');
      expect(failedTask.failureReason).toContain('target');
      expect(failedTask.transferResult.error).toBeDefined();
    });

    it('should fail when source grant has expired', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
        expiresAt: yesterday,
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toMatch(/expired|source/i);
    });

    it('should fail when target grant has expired', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
        expiresAt: tomorrow,
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
        expiresAt: yesterday,
      });

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toMatch(/expired|target/i);
    });

    it('should fail when source grant is revoked', async () => {
      const sourceGrant = grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });

      // Revoke source grant
      grantsService.revokeGrant(sourceGrant.grantId);

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toMatch(/revoked|source/i);
    });

    it('should fail when target grant is revoked', async () => {
      const sourceGrant = grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
      });

      const targetGrant = grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });

      // Revoke target grant
      grantsService.revokeGrant(targetGrant.grantId);

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toMatch(/revoked|target/i);
    });

    it('should fail when source path is outside approved folder', async () => {
      // Grant for /home/user/documents folder
      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.TRANSFER],
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });

      // Try to access file outside the folder
      const unauthorizedPath = '/home/user/private/secret.txt';

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {
          sourcePath: unauthorizedPath,
          targetPath,
          expectedDigest,
          expectedByteCount,
        },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toContain('Access denied');
    });

    it('should fail when source device is revoked', async () => {
      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });

      // Create task first, then revoke device
      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      // Revoke source device after task creation - update both storage and mock
      const revokedSourceDevice = devicesService.revokeDevice(sourceDeviceId);
      jest.spyOn(devicesService, 'findById').mockImplementation((deviceId: string) => {
        if (deviceId === sourceDeviceId) return revokedSourceDevice;
        if (deviceId === targetDeviceId) return devicesService['devices'].get(targetDeviceId);
        return null;
      });

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toMatch(/not trusted|revoked/i);
    });

    it('should fail when target device is revoked', async () => {
      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });

      // Create task first, then revoke device
      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      // Revoke target device after task creation - update both storage and mock
      const revokedTargetDevice = devicesService.revokeDevice(targetDeviceId);
      jest.spyOn(devicesService, 'findById').mockImplementation((deviceId: string) => {
        if (deviceId === sourceDeviceId) return devicesService['devices'].get(sourceDeviceId);
        if (deviceId === targetDeviceId) return revokedTargetDevice;
        return null;
      });

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.failureReason).toMatch(/not trusted|revoked/i);
    });
  });

  describe('executeTransfer - Digest/Byte Validation Failures', () => {
    beforeEach(() => {
      // Setup grants for all digest/byte tests
      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: sourcePath,
        capabilities: [Capability.TRANSFER],
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FILE_PATH,
        resourcePath: targetPath,
        capabilities: [Capability.TRANSFER],
      });
    });

    it('should fail when digest mismatch (CRITICAL - never SUCCEEDED)', async () => {
      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {
          sourcePath,
          targetPath,
          expectedDigest: 'wrongdigest123',
          expectedByteCount,
          // Test fixture flag to simulate digest mismatch
          __testSimulateDigestMismatch: true,
        },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      
      // CRITICAL: Must be FAILED, never SUCCEEDED
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.state).not.toBe(TaskState.SUCCEEDED);
      
      expect(failedTask.failureReason).toContain('Digest mismatch');
      expect(failedTask.failureReason).toContain('expected');
      expect(failedTask.failureReason).toContain('got');
      expect(failedTask.transferResult.actualDigest).toBeDefined();
      expect(failedTask.transferResult.actualDigest).not.toBe(failedTask.actionPayload.expectedDigest);
    });

    it('should fail when byte count mismatch', async () => {
      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {
          sourcePath,
          targetPath,
          expectedDigest,
          expectedByteCount: 9999,
          // Test fixture flag to simulate byte count mismatch
          __testSimulateByteCountMismatch: true,
        },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const failedTask = tasksService.findById(task.taskId);
      
      // Must be FAILED, never SUCCEEDED
      expect(failedTask.state).toBe(TaskState.FAILED);
      expect(failedTask.state).not.toBe(TaskState.SUCCEEDED);
      
      expect(failedTask.failureReason).toContain('Byte count mismatch');
      expect(failedTask.failureReason).toContain('expected');
      expect(failedTask.failureReason).toContain('got');
      expect(failedTask.transferResult.actualByteCount).toBeDefined();
      expect(failedTask.transferResult.actualByteCount).not.toBe(failedTask.actionPayload.expectedByteCount);
    });
  });

  describe('executeTransfer - Edge Cases', () => {
    it('should fail when task not found', async () => {
      await expect(
        service.executeTransfer('non-existent-task')
      ).rejects.toThrow('Task not found');
    });

    it('should fail when task not in APPROVED state', async () => {
      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { sourcePath, targetPath, expectedDigest, expectedByteCount },
      });

      // Try to execute without approval
      await expect(
        service.executeTransfer(task.taskId)
      ).rejects.toThrow(/state|approved/i);
    });

    it('should fail when task action is not TRANSFER_FILE', async () => {
      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.LIST_DEVICES,
        actionPayload: {},
      });

      await expect(
        service.executeTransfer(task.taskId)
      ).rejects.toThrow(/transfer_file/i);
    });
  });

  describe('Folder ACL enforcement with file paths', () => {
    it('should succeed when file is inside granted folder', async () => {
      // Grant folder access
      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.TRANSFER],
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/backup',
        capabilities: [Capability.TRANSFER],
      });

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {
          sourcePath: '/home/user/documents/file.txt',
          targetPath: '/home/user/backup/file.txt',
          expectedDigest,
          expectedByteCount,
        },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const completedTask = tasksService.findById(task.taskId);
      expect(completedTask.state).toBe(TaskState.SUCCEEDED);
    });

    it('should succeed with subfolder paths inside granted folder', async () => {
      grantsService.createGrant(userId, {
        deviceId: sourceDeviceId,
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.TRANSFER],
      });

      grantsService.createGrant(userId, {
        deviceId: targetDeviceId,
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/backup',
        capabilities: [Capability.TRANSFER],
      });

      const task = tasksService.createTask(userId, {
        sourceDeviceId,
        targetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {
          sourcePath: '/home/user/documents/subfolder/deep/file.txt',
          targetPath: '/home/user/backup/subfolder/deep/file.txt',
          expectedDigest,
          expectedByteCount,
        },
      });

      const approvedTask = tasksService.approveTask(task.taskId, userId);

      await service.executeTransfer(approvedTask.taskId);

      const completedTask = tasksService.findById(task.taskId);
      expect(completedTask.state).toBe(TaskState.SUCCEEDED);
    });
  });
});
