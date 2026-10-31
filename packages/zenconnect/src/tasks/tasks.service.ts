import { Injectable, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskState, CreateTaskDto, ActionType } from '../common/dto/task.dto';
import { TaskValidationService } from './task-validation.service';
import { DevicesService } from '../devices/devices.service';
import { GrantsService } from '../zencontrol/grants.service';
import { AuditService } from '../zencontrol/audit.service';
import { TrustStatus } from '../common/dto/device.dto';
import { ResourceType, Capability, AuditResult } from '../common/dto/zencontrol.dto';

@Injectable()
export class TasksService {
  private tasks: Map<string, Task> = new Map();
  private readonly DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly taskValidationService: TaskValidationService,
    private readonly devicesService: DevicesService,
    private readonly grantsService: GrantsService,
    private readonly auditService: AuditService,
  ) {}

  createTask(userId: string, createTaskDto: CreateTaskDto): Task {
    // Validate both source and target devices
    this.taskValidationService.validateTaskCreation(createTaskDto.sourceDeviceId, userId);
    this.taskValidationService.validateTaskCreation(createTaskDto.targetDeviceId, userId);

    const taskId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.DEFAULT_EXPIRY_MS);

    // Determine initial state based on action type
    const isTransferFile = createTaskDto.actionType === ActionType.TRANSFER_FILE;
    const initialState = isTransferFile ? TaskState.QUEUED : TaskState.APPROVED;

    const task: Task = {
      taskId,
      userId,
      sourceDeviceId: createTaskDto.sourceDeviceId,
      targetDeviceId: createTaskDto.targetDeviceId,
      actionType: createTaskDto.actionType,
      actionPayload: createTaskDto.actionPayload,
      state: initialState,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    // Auto-approve non-transfer_file tasks
    if (!isTransferFile) {
      task.approvedAt = now;
      task.approvedBy = 'system';
    }

    this.tasks.set(taskId, task);
    return task;
  }

  approveTask(taskId: string, approvedBy: string): Task {
    const task = this.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    this.validateStateTransition(task.state, TaskState.APPROVED);

    const now = new Date();
    task.state = TaskState.APPROVED;
    task.approvedAt = now;
    task.approvedBy = approvedBy;
    task.updatedAt = now;

    this.tasks.set(taskId, task);
    return task;
  }

  cancelTask(taskId: string, cancelReason?: string): Task {
    const task = this.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    this.validateStateTransition(task.state, TaskState.CANCELED);

    const now = new Date();
    task.state = TaskState.CANCELED;
    task.canceledAt = now;
    task.cancelReason = cancelReason || 'Canceled by user';
    task.updatedAt = now;

    this.tasks.set(taskId, task);
    return task;
  }

  expireTask(taskId: string): Task {
    const task = this.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    this.validateStateTransition(task.state, TaskState.EXPIRED);

    const now = new Date();
    task.state = TaskState.EXPIRED;
    task.updatedAt = now;

    this.tasks.set(taskId, task);
    return task;
  }

  checkAndExpireTasks(): Task[] {
    const now = new Date();
    const expiredTasks: Task[] = [];

    for (const task of this.tasks.values()) {
      // Only expire tasks in QUEUED state that are past their expiry time
      if (task.state === TaskState.QUEUED && task.expiresAt < now) {
        try {
          const expired = this.expireTask(task.taskId);
          expiredTasks.push(expired);
        } catch (error) {
          // Skip tasks that can't be expired (invalid state transition)
        }
      }
    }

    return expiredTasks;
  }

  executeTask(taskId: string): Task {
    const task = this.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    this.validateStateTransition(task.state, TaskState.EXECUTING);

    const now = new Date();
    task.state = TaskState.EXECUTING;
    task.updatedAt = now;

    this.tasks.set(taskId, task);
    return task;
  }

  async executeTaskWithValidation(taskId: string): Promise<Task> {
    const task = this.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    // M6: Pre-execution validation
    try {
      await this.validatePreExecution(task);
      
      // Record successful validation in audit
      this.auditService.recordCheck({
        userId: task.userId,
        deviceId: task.targetDeviceId,
        action: 'pre_execution_validation',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: task.actionPayload.targetPath || 'unknown',
        capability: Capability.TRANSFER,
        result: AuditResult.GRANTED,
      });

      // Proceed with execution
      return this.executeTask(taskId);
    } catch (error) {
      // Validation failed - fail the task
      const reason = error instanceof Error ? error.message : 'Pre-execution validation failed';
      this.failTask(taskId, reason);
      throw error;
    }
  }

  private async validatePreExecution(task: Task): Promise<void> {
    // Check target device trust status
    const targetDevice = this.devicesService.findById(task.targetDeviceId);
    if (!targetDevice) {
      const reason = 'Target device not found';
      this.auditService.recordCheck({
        userId: task.userId,
        deviceId: task.targetDeviceId,
        action: 'pre_execution_validation',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: task.actionPayload.targetPath || 'unknown',
        capability: Capability.TRANSFER,
        result: AuditResult.DENIED,
        reason,
      });
      throw new BadRequestException(reason);
    }

    if (targetDevice.trustStatus === TrustStatus.REVOKED) {
      const reason = 'Device revoked before execution';
      this.auditService.recordCheck({
        userId: task.userId,
        deviceId: task.targetDeviceId,
        action: 'pre_execution_validation',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: task.actionPayload.targetPath || 'unknown',
        capability: Capability.TRANSFER,
        result: AuditResult.DENIED,
        reason,
      });
      throw new BadRequestException(reason);
    }

    // Check source device trust status
    const sourceDevice = this.devicesService.findById(task.sourceDeviceId);
    if (!sourceDevice) {
      const reason = 'Source device not found';
      this.auditService.recordCheck({
        userId: task.userId,
        deviceId: task.sourceDeviceId,
        action: 'pre_execution_validation',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: task.actionPayload.sourcePath || 'unknown',
        capability: Capability.TRANSFER,
        result: AuditResult.DENIED,
        reason,
      });
      throw new BadRequestException(reason);
    }

    if (sourceDevice.trustStatus === TrustStatus.REVOKED) {
      const reason = 'Source device revoked before execution';
      this.auditService.recordCheck({
        userId: task.userId,
        deviceId: task.sourceDeviceId,
        action: 'pre_execution_validation',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: task.actionPayload.sourcePath || 'unknown',
        capability: Capability.TRANSFER,
        result: AuditResult.DENIED,
        reason,
      });
      throw new BadRequestException(reason);
    }

    // M6: Recheck grants for transfer_file tasks
    if (task.actionType === ActionType.TRANSFER_FILE) {
      // Check source grant
      const sourceGrant = this.grantsService.checkGrant(
        task.userId,
        task.sourceDeviceId,
        ResourceType.FILE_PATH,
        task.actionPayload.sourcePath,
        Capability.TRANSFER,
      );

      if (!sourceGrant.granted) {
        const reason = `Grant revoked/expired before execution: ${sourceGrant.reason}`;
        this.auditService.recordCheck({
          userId: task.userId,
          deviceId: task.sourceDeviceId,
          action: 'pre_execution_validation',
          resourceType: ResourceType.FILE_PATH,
          resourcePath: task.actionPayload.sourcePath,
          capability: Capability.TRANSFER,
          result: AuditResult.DENIED,
          reason,
        });
        throw new BadRequestException(reason);
      }

      // Check target grant
      const targetGrant = this.grantsService.checkGrant(
        task.userId,
        task.targetDeviceId,
        ResourceType.FILE_PATH,
        task.actionPayload.targetPath,
        Capability.TRANSFER,
      );

      if (!targetGrant.granted) {
        const reason = `Grant revoked/expired before execution: ${targetGrant.reason}`;
        this.auditService.recordCheck({
          userId: task.userId,
          deviceId: task.targetDeviceId,
          action: 'pre_execution_validation',
          resourceType: ResourceType.FILE_PATH,
          resourcePath: task.actionPayload.targetPath,
          capability: Capability.TRANSFER,
          result: AuditResult.DENIED,
          reason,
        });
        throw new BadRequestException(reason);
      }
    }
  }

  completeTask(taskId: string, result: any): Task {
    const task = this.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    this.validateStateTransition(task.state, TaskState.SUCCEEDED);

    const now = new Date();
    task.state = TaskState.SUCCEEDED;
    task.completedAt = now;
    task.transferResult = result;
    task.updatedAt = now;

    this.tasks.set(taskId, task);
    return task;
  }

  failTask(taskId: string, reason: string, result?: any): Task {
    const task = this.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    this.validateStateTransition(task.state, TaskState.FAILED);

    const now = new Date();
    task.state = TaskState.FAILED;
    task.completedAt = now;
    task.failureReason = reason;
    task.transferResult = result;
    task.updatedAt = now;

    this.tasks.set(taskId, task);
    return task;
  }

  findById(taskId: string): Task | null {
    return this.tasks.get(taskId) || null;
  }

  findByUserId(
    userId: string,
    filters?: {
      state?: TaskState;
      actionType?: ActionType;
      deviceId?: string;
    }
  ): Task[] {
    let tasks = Array.from(this.tasks.values()).filter(
      (task) => task.userId === userId
    );

    if (filters?.state) {
      tasks = tasks.filter((task) => task.state === filters.state);
    }

    if (filters?.actionType) {
      tasks = tasks.filter((task) => task.actionType === filters.actionType);
    }

    if (filters?.deviceId) {
      tasks = tasks.filter(
        (task) =>
          task.sourceDeviceId === filters.deviceId ||
          task.targetDeviceId === filters.deviceId
      );
    }

    return tasks;
  }

  private validateStateTransition(currentState: TaskState, nextState: TaskState): void {
    const validTransitions: Record<TaskState, TaskState[]> = {
      [TaskState.QUEUED]: [TaskState.APPROVED, TaskState.CANCELED, TaskState.EXPIRED],
      [TaskState.APPROVED]: [TaskState.EXECUTING, TaskState.CANCELED, TaskState.FAILED],
      [TaskState.EXECUTING]: [TaskState.SUCCEEDED, TaskState.FAILED],
      [TaskState.SUCCEEDED]: [],
      [TaskState.FAILED]: [],
      [TaskState.CANCELED]: [],
      [TaskState.EXPIRED]: [],
    };

    const allowed = validTransitions[currentState];
    if (!allowed.includes(nextState)) {
      throw new BadRequestException(
        `Invalid state transition: ${currentState} → ${nextState}`
      );
    }
  }
}
