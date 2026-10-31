import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskValidationService } from './task-validation.service';
import { DevicesService } from '../devices/devices.service';
import { GrantsService } from '../zencontrol/grants.service';
import { AuditService } from '../zencontrol/audit.service';
import { ActionType, TaskState, CreateTaskDto } from '../common/dto/task.dto';

describe('TasksService (M4 State Machine)', () => {
  let service: TasksService;
  let validationService: TaskValidationService;
  let devicesService: DevicesService;

  const mockUserId = 'user-123';
  const mockSourceDeviceId = 'device-source-456';
  const mockTargetDeviceId = 'device-target-789';

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
  });

  describe('createTask', () => {
    it('should create a transfer_file task in QUEUED state', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { filePath: '/path/to/file.txt' },
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);

      expect(task.taskId).toBeDefined();
      expect(task.userId).toBe(mockUserId);
      expect(task.sourceDeviceId).toBe(mockSourceDeviceId);
      expect(task.targetDeviceId).toBe(mockTargetDeviceId);
      expect(task.actionType).toBe(ActionType.TRANSFER_FILE);
      expect(task.state).toBe(TaskState.QUEUED);
      expect(task.approvedAt).toBeUndefined();
      expect(task.approvedBy).toBeUndefined();
      expect(task.expiresAt).toBeDefined();
      expect(task.createdAt).toBeDefined();
      expect(task.updatedAt).toBeDefined();
    });

    it('should auto-approve non-transfer_file tasks (list_devices)', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.LIST_DEVICES,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);

      expect(task.state).toBe(TaskState.APPROVED);
      expect(task.approvedAt).toBeDefined();
      expect(task.approvedBy).toBe('system');
    });

    it('should auto-approve task_status action', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TASK_STATUS,
        actionPayload: { taskId: 'some-task-id' },
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);

      expect(task.state).toBe(TaskState.APPROVED);
      expect(task.approvedBy).toBe('system');
    });

    it('should auto-approve summarize action', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.SUMMARIZE,
        actionPayload: { content: 'text to summarize' },
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);

      expect(task.state).toBe(TaskState.APPROVED);
      expect(task.approvedBy).toBe('system');
    });

    it('should validate source device ownership and trust', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      const validateSpy = jest.spyOn(validationService, 'validateTaskCreation');
      validateSpy.mockImplementation(() => {});

      service.createTask(mockUserId, createTaskDto);

      expect(validateSpy).toHaveBeenCalledWith(mockSourceDeviceId, mockUserId);
    });

    it('should validate target device ownership and trust', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      const validateSpy = jest.spyOn(validationService, 'validateTaskCreation');
      validateSpy.mockImplementation(() => {});

      service.createTask(mockUserId, createTaskDto);

      expect(validateSpy).toHaveBeenCalledWith(mockTargetDeviceId, mockUserId);
    });

    it('should reject task creation when target device is revoked', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation((deviceId: string) => {
        if (deviceId === mockTargetDeviceId) {
          throw new BadRequestException('Device has been revoked and cannot execute tasks');
        }
      });

      expect(() => service.createTask(mockUserId, createTaskDto)).toThrow(
        'Device has been revoked and cannot execute tasks'
      );
    });

    it('should reject task creation when source device is revoked', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation((deviceId: string) => {
        if (deviceId === mockSourceDeviceId) {
          throw new BadRequestException('Device has been revoked and cannot execute tasks');
        }
      });

      expect(() => service.createTask(mockUserId, createTaskDto)).toThrow(
        'Device has been revoked and cannot execute tasks'
      );
    });

    it('should set expiry to 24 hours by default', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);

      const expectedExpiry = new Date(task.createdAt.getTime() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(task.expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(100); // Allow 100ms tolerance
    });
  });

  describe('approveTask', () => {
    it('should transition QUEUED → APPROVED for transfer_file', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      expect(task.state).toBe(TaskState.QUEUED);

      const approved = service.approveTask(task.taskId, mockUserId);

      expect(approved.state).toBe(TaskState.APPROVED);
      expect(approved.approvedAt).toBeDefined();
      expect(approved.approvedBy).toBe(mockUserId);
      expect(approved.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });

    it('should reject approval of non-existent task', () => {
      expect(() => service.approveTask('non-existent-task-id', mockUserId)).toThrow(
        'Task not found'
      );
    });

    it('should reject approval if task is already approved', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      service.approveTask(task.taskId, mockUserId);

      expect(() => service.approveTask(task.taskId, mockUserId)).toThrow(
        'Invalid state transition: APPROVED → APPROVED'
      );
    });

    it('should reject approval if task is canceled', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      service.cancelTask(task.taskId, 'User canceled');

      expect(() => service.approveTask(task.taskId, mockUserId)).toThrow(
        'Invalid state transition: CANCELED → APPROVED'
      );
    });

    it('should reject approval if task is expired', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      
      // Manually expire the task
      const expiredTask = service.findById(task.taskId);
      if (expiredTask) {
        expiredTask.expiresAt = new Date(Date.now() - 1000);
        expiredTask.state = TaskState.EXPIRED;
      }

      expect(() => service.approveTask(task.taskId, mockUserId)).toThrow(
        'Invalid state transition: EXPIRED → APPROVED'
      );
    });
  });

  describe('cancelTask', () => {
    it('should transition QUEUED → CANCELED', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      expect(task.state).toBe(TaskState.QUEUED);

      const canceled = service.cancelTask(task.taskId, 'User requested cancellation');

      expect(canceled.state).toBe(TaskState.CANCELED);
      expect(canceled.canceledAt).toBeDefined();
      expect(canceled.cancelReason).toBe('User requested cancellation');
    });

    it('should transition APPROVED → CANCELED', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      service.approveTask(task.taskId, mockUserId);

      const canceled = service.cancelTask(task.taskId, 'Changed my mind');

      expect(canceled.state).toBe(TaskState.CANCELED);
      expect(canceled.cancelReason).toBe('Changed my mind');
    });

    it('should reject cancellation of non-existent task', () => {
      expect(() => service.cancelTask('non-existent-task-id', 'reason')).toThrow(
        'Task not found'
      );
    });

    it('should reject cancellation of already canceled task', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      service.cancelTask(task.taskId, 'First cancel');

      expect(() => service.cancelTask(task.taskId, 'Second cancel')).toThrow(
        'Invalid state transition: CANCELED → CANCELED'
      );
    });

    it('should use default cancel reason if none provided', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      const canceled = service.cancelTask(task.taskId);

      expect(canceled.cancelReason).toBe('Canceled by user');
    });
  });

  describe('expireTask', () => {
    it('should transition QUEUED → EXPIRED', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      expect(task.state).toBe(TaskState.QUEUED);

      const expired = service.expireTask(task.taskId);

      expect(expired.state).toBe(TaskState.EXPIRED);
      expect(expired.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });

    it('should reject expiring non-existent task', () => {
      expect(() => service.expireTask('non-existent-task-id')).toThrow(
        'Task not found'
      );
    });

    it('should reject expiring already approved task', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      service.approveTask(task.taskId, mockUserId);

      expect(() => service.expireTask(task.taskId)).toThrow(
        'Invalid state transition: APPROVED → EXPIRED'
      );
    });
  });

  describe('checkAndExpireTasks', () => {
    it('should expire tasks past their expiry time', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      
      // Manually set expiry to past
      const taskToExpire = service.findById(task.taskId);
      if (taskToExpire) {
        taskToExpire.expiresAt = new Date(Date.now() - 1000);
      }

      const expiredTasks = service.checkAndExpireTasks();

      expect(expiredTasks).toHaveLength(1);
      expect(expiredTasks[0].taskId).toBe(task.taskId);
      expect(expiredTasks[0].state).toBe(TaskState.EXPIRED);
    });

    it('should not expire tasks that are still valid', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      service.createTask(mockUserId, createTaskDto);

      const expiredTasks = service.checkAndExpireTasks();

      expect(expiredTasks).toHaveLength(0);
    });

    it('should not expire already canceled tasks', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      service.cancelTask(task.taskId, 'User canceled');

      const taskToExpire = service.findById(task.taskId);
      if (taskToExpire) {
        taskToExpire.expiresAt = new Date(Date.now() - 1000);
      }

      const expiredTasks = service.checkAndExpireTasks();

      expect(expiredTasks).toHaveLength(0);
    });

    it('should not expire already approved tasks', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      service.approveTask(task.taskId, mockUserId);

      const taskToExpire = service.findById(task.taskId);
      if (taskToExpire) {
        taskToExpire.expiresAt = new Date(Date.now() - 1000);
      }

      const expiredTasks = service.checkAndExpireTasks();

      expect(expiredTasks).toHaveLength(0);
    });
  });

  describe('findByUserId', () => {
    it('should return all tasks for a user', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      service.createTask(mockUserId, createTaskDto);
      service.createTask(mockUserId, createTaskDto);

      const tasks = service.findByUserId(mockUserId);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].userId).toBe(mockUserId);
      expect(tasks[1].userId).toBe(mockUserId);
    });

    it('should filter by state', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task1 = service.createTask(mockUserId, createTaskDto);
      const task2 = service.createTask(mockUserId, createTaskDto);
      service.approveTask(task2.taskId, mockUserId);

      const queuedTasks = service.findByUserId(mockUserId, { state: TaskState.QUEUED });
      const approvedTasks = service.findByUserId(mockUserId, { state: TaskState.APPROVED });

      expect(queuedTasks).toHaveLength(1);
      expect(queuedTasks[0].taskId).toBe(task1.taskId);
      expect(approvedTasks).toHaveLength(1);
      expect(approvedTasks[0].taskId).toBe(task2.taskId);
    });

    it('should filter by actionType', () => {
      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      service.createTask(mockUserId, {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      });

      service.createTask(mockUserId, {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.LIST_DEVICES,
        actionPayload: {},
      });

      const transferTasks = service.findByUserId(mockUserId, { actionType: ActionType.TRANSFER_FILE });
      const listTasks = service.findByUserId(mockUserId, { actionType: ActionType.LIST_DEVICES });

      expect(transferTasks).toHaveLength(1);
      expect(transferTasks[0].actionType).toBe(ActionType.TRANSFER_FILE);
      expect(listTasks).toHaveLength(1);
      expect(listTasks[0].actionType).toBe(ActionType.LIST_DEVICES);
    });

    it('should filter by deviceId (source or target)', () => {
      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task1 = service.createTask(mockUserId, {
        sourceDeviceId: 'device-A',
        targetDeviceId: 'device-B',
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      });

      const task2 = service.createTask(mockUserId, {
        sourceDeviceId: 'device-C',
        targetDeviceId: 'device-A',
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      });

      service.createTask(mockUserId, {
        sourceDeviceId: 'device-D',
        targetDeviceId: 'device-E',
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      });

      const deviceATasks = service.findByUserId(mockUserId, { deviceId: 'device-A' });

      expect(deviceATasks).toHaveLength(2);
      expect(deviceATasks.map(t => t.taskId).sort()).toEqual([task1.taskId, task2.taskId].sort());
    });
  });

  describe('findById', () => {
    it('should return task by id', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      jest.spyOn(validationService, 'validateTaskCreation').mockImplementation(() => {});

      const task = service.createTask(mockUserId, createTaskDto);
      const found = service.findById(task.taskId);

      expect(found).toBeDefined();
      expect(found?.taskId).toBe(task.taskId);
    });

    it('should return null for non-existent task', () => {
      const found = service.findById('non-existent-task-id');
      expect(found).toBeNull();
    });
  });
});
