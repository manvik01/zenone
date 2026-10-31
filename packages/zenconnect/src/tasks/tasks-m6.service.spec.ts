import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskValidationService } from './task-validation.service';
import { DevicesService } from '../devices/devices.service';
import { GrantsService } from '../zencontrol/grants.service';
import { AuditService } from '../zencontrol/audit.service';
import { ActionType, TaskState, CreateTaskDto } from '../common/dto/task.dto';
import { TrustStatus, Platform } from '../common/dto/device.dto';
import { ResourceType, Capability, AuditResult } from '../common/dto/zencontrol.dto';

describe('TasksService (M6 Queued Expiry and Auth Recheck)', () => {
  let service: TasksService;
  let validationService: TaskValidationService;
  let devicesService: DevicesService;
  let grantsService: GrantsService;
  let auditService: AuditService;

  const mockUserId = 'user-123';
  const mockSourceDeviceId = 'device-source-456';
  const mockTargetDeviceId = 'device-target-789';

  // Helper: Create transfer task DTO
  const createTransferTaskDto = (sourcePath = '/path/to/file.txt', targetPath = '/destination/file.txt'): CreateTaskDto => ({
    sourceDeviceId: mockSourceDeviceId,
    targetDeviceId: mockTargetDeviceId,
    actionType: ActionType.TRANSFER_FILE,
    actionPayload: { sourcePath, targetPath },
  });

  // Helper: Create mock device
  const createMockDevice = (deviceId: string, trustStatus: TrustStatus) => ({
    deviceId,
    userId: mockUserId,
    platform: Platform.MACOS,
    deviceName: 'Device',
    publicKey: 'key',
    capabilities: [],
    lastSeen: new Date(),
    trustStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Helper: Setup basic mocks
  const setupBasicMocks = () => {
    jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});
  };

  // Helper: Setup trusted device mocks
  const setupTrustedDeviceMocks = () => {
    jest.spyOn(devicesService, 'findById').mockImplementation((deviceId) => 
      createMockDevice(deviceId, TrustStatus.TRUSTED)
    );
  };

  // Helper: Setup valid grant mocks
  const setupValidGrantMocks = () => {
    jest.spyOn(grantsService, 'checkGrant').mockReturnValue({ granted: true });
  };

  // Helper: Create and approve task
  const createAndApproveTask = (dto: CreateTaskDto) => {
    const task = service.createTask(mockUserId, dto);
    service.approveTask(task.taskId, mockUserId);
    return task;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        TaskValidationService,
        {
          provide: DevicesService,
          useValue: {
            findById: jest.fn(),
            canDeviceExecuteTasks: jest.fn(),
            isDeviceOnline: jest.fn(),
          },
        },
        {
          provide: GrantsService,
          useValue: {
            checkGrant: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            recordCheck: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    validationService = module.get<TaskValidationService>(TaskValidationService);
    devicesService = module.get<DevicesService>(DevicesService);
    grantsService = module.get<GrantsService>(GrantsService);
    auditService = module.get<AuditService>(AuditService);
  });

  describe('M6-1: Offline Detection → QUEUED', () => {
    it('should create task in QUEUED state when target device is offline', () => {
      setupBasicMocks();
      jest.spyOn(devicesService, 'isDeviceOnline').mockReturnValue(false);

      const task = service.createTask(mockUserId, createTransferTaskDto());

      expect(task.state).toBe(TaskState.QUEUED);
      expect(task.expiresAt).toBeDefined();
      expect(task.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should set expiresAt to 24 hours from creation for queued task', () => {
      setupBasicMocks();

      const task = service.createTask(mockUserId, createTransferTaskDto());

      const expectedExpiry = new Date(task.createdAt.getTime() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(task.expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(100);
    });
  });

  describe('M6-2: Expiry Enforcement', () => {
    it('should transition QUEUED → EXPIRED when past deadline', () => {
      setupBasicMocks();
      const task = service.createTask(mockUserId, createTransferTaskDto('', ''));
      
      const taskToExpire = service.findById(task.taskId);
      if (taskToExpire) taskToExpire.expiresAt = new Date(Date.now() - 1000);

      const expiredTasks = service.checkAndExpireTasks();

      expect(expiredTasks).toHaveLength(1);
      expect(expiredTasks[0].state).toBe(TaskState.EXPIRED);
    });

    it('should never set SUCCEEDED for expired task', () => {
      setupBasicMocks();
      const task = service.createTask(mockUserId, createTransferTaskDto('', ''));
      
      const taskToExpire = service.findById(task.taskId);
      if (taskToExpire) taskToExpire.expiresAt = new Date(Date.now() - 1000);
      service.checkAndExpireTasks();

      expect(() => service.completeTask(task.taskId, {})).toThrow(
        'Invalid state transition: EXPIRED → SUCCEEDED'
      );
    });

    it('should provide clear expiry reason in task state', () => {
      setupBasicMocks();
      const task = service.createTask(mockUserId, createTransferTaskDto('', ''));
      
      const taskToExpire = service.findById(task.taskId);
      if (taskToExpire) taskToExpire.expiresAt = new Date(Date.now() - 1000);

      const expiredTasks = service.checkAndExpireTasks();

      expect(expiredTasks[0].state).toBe(TaskState.EXPIRED);
      expect(expiredTasks[0].expiresAt.getTime()).toBeLessThan(Date.now());
    });
  });

  describe('M6-3: Device Revocation Recheck Before Execution', () => {
    it('should fail pre-execution validation when target device is revoked', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      jest.spyOn(devicesService, 'findById').mockReturnValue(
        createMockDevice(mockTargetDeviceId, TrustStatus.REVOKED)
      );

      await expect(service.executeTaskWithValidation(task.taskId)).rejects.toThrow(
        'Device revoked before execution'
      );

      const failedTask = service.findById(task.taskId);
      expect(failedTask?.state).toBe(TaskState.FAILED);
      expect(failedTask?.failureReason).toContain('Device revoked');
    });

    it('should record audit trail when device revocation check fails', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      jest.spyOn(devicesService, 'findById').mockReturnValue(
        createMockDevice(mockTargetDeviceId, TrustStatus.REVOKED)
      );

      const auditSpy = jest.spyOn(auditService, 'recordCheck');

      await expect(service.executeTaskWithValidation(task.taskId)).rejects.toThrow();

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          deviceId: mockTargetDeviceId,
          action: 'pre_execution_validation',
          result: AuditResult.DENIED,
          reason: expect.stringContaining('Device revoked'),
        })
      );
    });
  });

  describe('M6-4: Grant Revocation Recheck Before Execution', () => {
    it('should fail when source grant is revoked before execution', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      setupTrustedDeviceMocks();
      jest.spyOn(grantsService, 'checkGrant').mockImplementation((userId, deviceId) => {
        if (deviceId === mockSourceDeviceId) {
          return { granted: false, reason: 'Grant revoked' };
        }
        return { granted: true };
      });

      await expect(service.executeTaskWithValidation(task.taskId)).rejects.toThrow(
        'Grant revoked/expired before execution'
      );

      const failedTask = service.findById(task.taskId);
      expect(failedTask?.state).toBe(TaskState.FAILED);
      expect(failedTask?.failureReason).toContain('Grant revoked');
    });

    it('should fail when target grant is revoked before execution', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      setupTrustedDeviceMocks();
      jest.spyOn(grantsService, 'checkGrant').mockImplementation((userId, deviceId) => {
        if (deviceId === mockTargetDeviceId) {
          return { granted: false, reason: 'Grant revoked' };
        }
        return { granted: true };
      });

      await expect(service.executeTaskWithValidation(task.taskId)).rejects.toThrow(
        'Grant revoked/expired before execution'
      );

      const failedTask = service.findById(task.taskId);
      expect(failedTask?.state).toBe(TaskState.FAILED);
    });

    it('should record audit trail when grant check fails', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      setupTrustedDeviceMocks();
      jest.spyOn(grantsService, 'checkGrant').mockReturnValue({
        granted: false,
        reason: 'Grant revoked',
      });

      const auditSpy = jest.spyOn(auditService, 'recordCheck');

      await expect(service.executeTaskWithValidation(task.taskId)).rejects.toThrow();

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: 'pre_execution_validation',
          result: AuditResult.DENIED,
          reason: expect.stringContaining('Grant'),
        })
      );
    });
  });

  describe('M6-5: Grant Expiry Recheck Before Execution', () => {
    it('should fail when grant expires before execution', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      setupTrustedDeviceMocks();
      jest.spyOn(grantsService, 'checkGrant').mockReturnValue({
        granted: false,
        reason: 'Grant expired',
      });

      await expect(service.executeTaskWithValidation(task.taskId)).rejects.toThrow(
        'Grant revoked/expired before execution'
      );

      const failedTask = service.findById(task.taskId);
      expect(failedTask?.state).toBe(TaskState.FAILED);
      expect(failedTask?.failureReason).toContain('Grant');
    });
  });

  describe('M6-6: Cancel While Queued', () => {
    it('should allow canceling QUEUED task', () => {
      setupBasicMocks();
      const task = service.createTask(mockUserId, createTransferTaskDto('', ''));
      expect(task.state).toBe(TaskState.QUEUED);

      const canceled = service.cancelTask(task.taskId, 'User canceled while queued');

      expect(canceled.state).toBe(TaskState.CANCELED);
      expect(canceled.cancelReason).toBe('User canceled while queued');
    });
  });

  describe('M6-7: Happy Path with Validation', () => {
    it('should successfully execute when device is trusted and grants are valid', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      setupTrustedDeviceMocks();
      setupValidGrantMocks();

      const executingTask = await service.executeTaskWithValidation(task.taskId);

      expect(executingTask.state).toBe(TaskState.EXECUTING);
    });

    it('should complete task after successful execution with valid grants', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      setupTrustedDeviceMocks();
      setupValidGrantMocks();

      const executingTask = await service.executeTaskWithValidation(task.taskId);
      const completedTask = service.completeTask(executingTask.taskId, {
        actualDigest: 'sha256-hash',
        actualByteCount: 1024,
        sourceGrantChecked: true,
        targetGrantChecked: true,
      });

      expect(completedTask.state).toBe(TaskState.SUCCEEDED);
      expect(completedTask.transferResult).toBeDefined();
    });
  });

  describe('M6-8: Audit Trail for All Recheck Failures', () => {
    it('should record audit entry for device revocation failure', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      jest.spyOn(devicesService, 'findById').mockReturnValue(
        createMockDevice(mockTargetDeviceId, TrustStatus.REVOKED)
      );

      const auditSpy = jest.spyOn(auditService, 'recordCheck');

      await expect(service.executeTaskWithValidation(task.taskId)).rejects.toThrow();

      expect(auditSpy).toHaveBeenCalled();
    });

    it('should record audit entry for grant check failure', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      setupTrustedDeviceMocks();
      jest.spyOn(grantsService, 'checkGrant').mockReturnValue({
        granted: false,
        reason: 'Grant expired',
      });

      const auditSpy = jest.spyOn(auditService, 'recordCheck');

      await expect(service.executeTaskWithValidation(task.taskId)).rejects.toThrow();

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          result: AuditResult.DENIED,
        })
      );
    });

    it('should record successful validation in audit trail', async () => {
      setupBasicMocks();
      const task = createAndApproveTask(createTransferTaskDto());

      setupTrustedDeviceMocks();
      setupValidGrantMocks();

      const auditSpy = jest.spyOn(auditService, 'recordCheck');

      await service.executeTaskWithValidation(task.taskId);

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          result: AuditResult.GRANTED,
          action: 'pre_execution_validation',
        })
      );
    });
  });
});
