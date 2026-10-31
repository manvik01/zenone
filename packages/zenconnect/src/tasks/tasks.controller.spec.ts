import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskValidationService } from './task-validation.service';
import { TransferExecutionService } from '../transfers/transfer-execution.service';
import { DevicesService } from '../devices/devices.service';
import { ActionType, TaskState, CreateTaskDto } from '../common/dto/task.dto';
import { RequestWithUser } from '../identity/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';

describe('TasksController (M4 State Machine)', () => {
  let controller: TasksController;
  let service: TasksService;

  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';
  const mockSourceDeviceId = 'device-source-456';
  const mockTargetDeviceId = 'device-target-789';

  const mockRequest = (userId: string = mockUserId): RequestWithUser => {
    return {
      user: { userId, email: mockEmail },
    } as RequestWithUser;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
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
          provide: TransferExecutionService,
          useValue: {
            executeTransfer: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = { userId: mockUserId, email: mockEmail };
          return true;
        },
      })
      .compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);
  });

  describe('POST /v1/tasks (createTask)', () => {
    it('should create a transfer_file task', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: { filePath: '/path/to/file.txt' },
      };

      jest.spyOn(service, 'createTask').mockImplementation((userId, dto) => ({
        taskId: 'task-123',
        userId,
        sourceDeviceId: dto.sourceDeviceId,
        targetDeviceId: dto.targetDeviceId,
        actionType: dto.actionType,
        actionPayload: dto.actionPayload,
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }));

      const result = controller.createTask(createTaskDto, mockRequest());

      expect(result.taskId).toBe('task-123');
      expect(result.userId).toBe(mockUserId);
      expect(result.state).toBe(TaskState.QUEUED);
      expect(result.actionType).toBe(ActionType.TRANSFER_FILE);
    });

    it('should require authentication', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
      };

      const reqWithoutUser = { user: undefined } as RequestWithUser;

      expect(() => controller.createTask(createTaskDto, reqWithoutUser)).toThrow(
        'User not authenticated'
      );
    });

    it('should auto-approve non-transfer_file tasks', () => {
      const createTaskDto: CreateTaskDto = {
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.LIST_DEVICES,
        actionPayload: {},
      };

      jest.spyOn(service, 'createTask').mockImplementation((userId, dto) => ({
        taskId: 'task-124',
        userId,
        sourceDeviceId: dto.sourceDeviceId,
        targetDeviceId: dto.targetDeviceId,
        actionType: dto.actionType,
        actionPayload: dto.actionPayload,
        state: TaskState.APPROVED,
        approvedAt: new Date(),
        approvedBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }));

      const result = controller.createTask(createTaskDto, mockRequest());

      expect(result.state).toBe(TaskState.APPROVED);
      expect(result.approvedBy).toBe('system');
    });
  });

  describe('GET /v1/tasks (listTasks)', () => {
    it('should list all user tasks', () => {
      const mockTasks = [
        {
          taskId: 'task-1',
          userId: mockUserId,
          sourceDeviceId: mockSourceDeviceId,
          targetDeviceId: mockTargetDeviceId,
          actionType: ActionType.TRANSFER_FILE,
          actionPayload: {},
          state: TaskState.QUEUED,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(),
        },
        {
          taskId: 'task-2',
          userId: mockUserId,
          sourceDeviceId: mockSourceDeviceId,
          targetDeviceId: mockTargetDeviceId,
          actionType: ActionType.LIST_DEVICES,
          actionPayload: {},
          state: TaskState.APPROVED,
          approvedAt: new Date(),
          approvedBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(),
        },
      ];

      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findByUserId').mockReturnValue(mockTasks);

      const result = controller.listTasks({}, mockRequest());

      expect(result).toHaveLength(2);
      expect(result[0].taskId).toBe('task-1');
      expect(result[1].taskId).toBe('task-2');
    });

    it('should filter by state', () => {
      const mockTasks = [
        {
          taskId: 'task-1',
          userId: mockUserId,
          sourceDeviceId: mockSourceDeviceId,
          targetDeviceId: mockTargetDeviceId,
          actionType: ActionType.TRANSFER_FILE,
          actionPayload: {},
          state: TaskState.QUEUED,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: new Date(),
        },
      ];

      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findByUserId').mockReturnValue(mockTasks);

      const result = controller.listTasks({ state: TaskState.QUEUED }, mockRequest());

      expect(service.findByUserId).toHaveBeenCalledWith(mockUserId, {
        state: TaskState.QUEUED,
        actionType: undefined,
        deviceId: undefined,
      });
      expect(result).toHaveLength(1);
      expect(result[0].state).toBe(TaskState.QUEUED);
    });

    it('should filter by actionType', () => {
      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findByUserId').mockReturnValue([]);

      controller.listTasks({ actionType: ActionType.TRANSFER_FILE }, mockRequest());

      expect(service.findByUserId).toHaveBeenCalledWith(mockUserId, {
        state: undefined,
        actionType: ActionType.TRANSFER_FILE,
        deviceId: undefined,
      });
    });

    it('should filter by deviceId', () => {
      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findByUserId').mockReturnValue([]);

      controller.listTasks({ deviceId: 'device-123' }, mockRequest());

      expect(service.findByUserId).toHaveBeenCalledWith(mockUserId, {
        state: undefined,
        actionType: undefined,
        deviceId: 'device-123',
      });
    });

    it('should check and expire tasks before listing', () => {
      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findByUserId').mockReturnValue([]);

      controller.listTasks({}, mockRequest());

      expect(service.checkAndExpireTasks).toHaveBeenCalled();
    });

    it('should require authentication', () => {
      const reqWithoutUser = { user: undefined } as RequestWithUser;

      expect(() => controller.listTasks({}, reqWithoutUser)).toThrow(
        'User not authenticated'
      );
    });
  });

  describe('GET /v1/tasks/:taskId (getTask)', () => {
    it('should return task by id', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: mockUserId,
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findById').mockReturnValue(mockTask);

      const result = controller.getTask('task-123', mockRequest());

      expect(result.taskId).toBe('task-123');
      expect(result.userId).toBe(mockUserId);
    });

    it('should throw error if task not found', () => {
      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findById').mockReturnValue(null);

      expect(() => controller.getTask('non-existent', mockRequest())).toThrow(
        'Task not found'
      );
    });

    it('should reject unauthorized access', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: 'different-user',
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findById').mockReturnValue(mockTask);

      expect(() => controller.getTask('task-123', mockRequest())).toThrow(
        'Unauthorized to access this task'
      );
    });

    it('should check and expire tasks before retrieving', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: mockUserId,
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findById').mockReturnValue(mockTask);

      controller.getTask('task-123', mockRequest());

      expect(service.checkAndExpireTasks).toHaveBeenCalled();
    });

    it('should require authentication', () => {
      const reqWithoutUser = { user: undefined } as RequestWithUser;

      expect(() => controller.getTask('task-123', reqWithoutUser)).toThrow(
        'User not authenticated'
      );
    });
  });

  describe('GET /v1/tasks/:taskId/status (getTaskStatus)', () => {
    it('should return task status', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: mockUserId,
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findById').mockReturnValue(mockTask);

      const result = controller.getTaskStatus('task-123', mockRequest());

      expect(result.taskId).toBe('task-123');
      expect(result.state).toBe(TaskState.APPROVED);
      expect(result.updatedAt).toBeDefined();
    });

    it('should reject unauthorized access', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: 'different-user',
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      jest.spyOn(service, 'checkAndExpireTasks').mockReturnValue([]);
      jest.spyOn(service, 'findById').mockReturnValue(mockTask);

      expect(() => controller.getTaskStatus('task-123', mockRequest())).toThrow(
        'Unauthorized to access this task'
      );
    });
  });

  describe('POST /v1/tasks/:taskId/approve (approveTask)', () => {
    it('should approve a queued task', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: mockUserId,
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const mockApprovedTask = {
        ...mockTask,
        state: TaskState.APPROVED,
        approvedAt: new Date(),
        approvedBy: mockUserId,
      };

      jest.spyOn(service, 'findById').mockReturnValue(mockTask);
      jest.spyOn(service, 'approveTask').mockReturnValue(mockApprovedTask);

      const result = controller.approveTask('task-123', {}, mockRequest());

      expect(result.state).toBe(TaskState.APPROVED);
      expect(result.approvedBy).toBe(mockUserId);
      expect(service.approveTask).toHaveBeenCalledWith('task-123', mockUserId);
    });

    it('should use custom approvedBy if provided', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: mockUserId,
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      jest.spyOn(service, 'findById').mockReturnValue(mockTask);
      jest.spyOn(service, 'approveTask').mockImplementation((taskId, approvedBy) => ({
        ...mockTask,
        state: TaskState.APPROVED,
        approvedAt: new Date(),
        approvedBy,
      }));

      controller.approveTask('task-123', { approvedBy: 'custom-approver' }, mockRequest());

      expect(service.approveTask).toHaveBeenCalledWith('task-123', 'custom-approver');
    });

    it('should reject unauthorized approval', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: 'different-user',
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      jest.spyOn(service, 'findById').mockReturnValue(mockTask);

      expect(() => controller.approveTask('task-123', {}, mockRequest())).toThrow(
        'Unauthorized to approve this task'
      );
    });

    it('should require authentication', () => {
      const reqWithoutUser = { user: undefined } as RequestWithUser;

      expect(() => controller.approveTask('task-123', {}, reqWithoutUser)).toThrow(
        'User not authenticated'
      );
    });
  });

  describe('POST /v1/tasks/:taskId/cancel (cancelTask)', () => {
    it('should cancel a queued task', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: mockUserId,
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      const mockCanceledTask = {
        ...mockTask,
        state: TaskState.CANCELED,
        canceledAt: new Date(),
        cancelReason: 'User requested',
      };

      jest.spyOn(service, 'findById').mockReturnValue(mockTask);
      jest.spyOn(service, 'cancelTask').mockReturnValue(mockCanceledTask);

      const result = controller.cancelTask('task-123', { cancelReason: 'User requested' }, mockRequest());

      expect(result.state).toBe(TaskState.CANCELED);
      expect(result.cancelReason).toBe('User requested');
      expect(service.cancelTask).toHaveBeenCalledWith('task-123', 'User requested');
    });

    it('should reject unauthorized cancellation', () => {
      const mockTask = {
        taskId: 'task-123',
        userId: 'different-user',
        sourceDeviceId: mockSourceDeviceId,
        targetDeviceId: mockTargetDeviceId,
        actionType: ActionType.TRANSFER_FILE,
        actionPayload: {},
        state: TaskState.QUEUED,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      jest.spyOn(service, 'findById').mockReturnValue(mockTask);

      expect(() => controller.cancelTask('task-123', {}, mockRequest())).toThrow(
        'Unauthorized to cancel this task'
      );
    });

    it('should require authentication', () => {
      const reqWithoutUser = { user: undefined } as RequestWithUser;

      expect(() => controller.cancelTask('task-123', {}, reqWithoutUser)).toThrow(
        'User not authenticated'
      );
    });
  });
});
