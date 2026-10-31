import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus, CreateTaskDto } from '../common/dto/task.dto';

@Injectable()
export class TasksService {
  private tasks: Map<string, Task> = new Map();

  create(requesterDeviceId: string, createTaskDto: CreateTaskDto): Task {
    const taskId = uuidv4();
    const idempotencyKey = createTaskDto.idempotencyKey || uuidv4();

    const existingTask = this.findByIdempotencyKey(idempotencyKey);
    if (existingTask) {
      return existingTask;
    }

    const task: Task = {
      taskId,
      requesterDeviceId,
      executorDeviceId: createTaskDto.executorDeviceId,
      actionType: createTaskDto.actionType,
      payload: createTaskDto.payload,
      idempotencyKey,
      status: TaskStatus.CREATED,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    };

    this.tasks.set(taskId, task);
    return task;
  }

  findById(taskId: string): Task | null {
    return this.tasks.get(taskId) || null;
  }

  findByIdempotencyKey(idempotencyKey: string): Task | null {
    return Array.from(this.tasks.values()).find(
      (task) => task.idempotencyKey === idempotencyKey,
    ) || null;
  }

  updateStatus(taskId: string, status: TaskStatus): Task {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    task.status = status;
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);

    return task;
  }

  approve(taskId: string): Task {
    return this.updateStatus(taskId, TaskStatus.QUEUED);
  }

  cancel(taskId: string): Task {
    return this.updateStatus(taskId, TaskStatus.CANCELLED);
  }

  findByDevice(deviceId: string): Task[] {
    return Array.from(this.tasks.values()).filter(
      (task) =>
        task.requesterDeviceId === deviceId || task.executorDeviceId === deviceId,
    );
  }
}
