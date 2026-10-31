import { Controller, Post, Get, Body, Param, Headers } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, TaskResponseDto } from '../common/dto/task.dto';

@Controller('v1/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  createTask(
    @Body() createTaskDto: CreateTaskDto,
    @Headers('x-device-id') requesterDeviceId: string,
  ): TaskResponseDto {
    const task = this.tasksService.create(requesterDeviceId, createTaskDto);
    return this.toResponseDto(task);
  }

  @Get(':taskId')
  getTask(@Param('taskId') taskId: string): TaskResponseDto {
    const task = this.tasksService.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    return this.toResponseDto(task);
  }

  @Post(':taskId/approve')
  approveTask(@Param('taskId') taskId: string): TaskResponseDto {
    const task = this.tasksService.approve(taskId);
    return this.toResponseDto(task);
  }

  @Post(':taskId/cancel')
  cancelTask(@Param('taskId') taskId: string): TaskResponseDto {
    const task = this.tasksService.cancel(taskId);
    return this.toResponseDto(task);
  }

  private toResponseDto(task: any): TaskResponseDto {
    return {
      taskId: task.taskId,
      requesterDeviceId: task.requesterDeviceId,
      executorDeviceId: task.executorDeviceId,
      actionType: task.actionType,
      status: task.status,
      createdAt: task.createdAt,
      expiresAt: task.expiresAt,
      updatedAt: task.updatedAt,
    };
  }
}
