import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TransferExecutionService } from '../transfers/transfer-execution.service';
import {
  CreateTaskDto,
  TaskResponseDto,
  ApproveTaskDto,
  CancelTaskDto,
  ListTasksQueryDto,
  TaskState,
  ActionType,
} from '../common/dto/task.dto';
import { JwtAuthGuard, RequestWithUser } from '../identity/jwt-auth.guard';

@Controller('v1/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly transferExecutionService: TransferExecutionService,
  ) {}

  @Post()
  createTask(
    @Body() createTaskDto: CreateTaskDto,
    @Request() req: RequestWithUser,
  ): TaskResponseDto {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const task = this.tasksService.createTask(userId, createTaskDto);
    return this.toResponseDto(task);
  }

  @Get()
  listTasks(
    @Query() query: ListTasksQueryDto,
    @Request() req: RequestWithUser,
  ): TaskResponseDto[] {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Check and expire tasks before listing
    this.tasksService.checkAndExpireTasks();

    const tasks = this.tasksService.findByUserId(userId, {
      state: query.state,
      actionType: query.actionType,
      deviceId: query.deviceId,
    });

    return tasks.map((task) => this.toResponseDto(task));
  }

  @Get(':taskId')
  getTask(
    @Param('taskId') taskId: string,
    @Request() req: RequestWithUser,
  ): TaskResponseDto {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Check and expire tasks before retrieving
    this.tasksService.checkAndExpireTasks();

    const task = this.tasksService.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    // Verify ownership
    if (task.userId !== userId) {
      throw new BadRequestException('Unauthorized to access this task');
    }

    return this.toResponseDto(task);
  }

  @Get(':taskId/status')
  getTaskStatus(
    @Param('taskId') taskId: string,
    @Request() req: RequestWithUser,
  ): { taskId: string; state: TaskState; updatedAt: Date } {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    // Check and expire tasks before retrieving status
    this.tasksService.checkAndExpireTasks();

    const task = this.tasksService.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    // Verify ownership
    if (task.userId !== userId) {
      throw new BadRequestException('Unauthorized to access this task');
    }

    return {
      taskId: task.taskId,
      state: task.state,
      updatedAt: task.updatedAt,
    };
  }

  @Post(':taskId/approve')
  approveTask(
    @Param('taskId') taskId: string,
    @Body() approveDto: ApproveTaskDto,
    @Request() req: RequestWithUser,
  ): TaskResponseDto {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const task = this.tasksService.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    // Verify ownership
    if (task.userId !== userId) {
      throw new BadRequestException('Unauthorized to approve this task');
    }

    const approvedBy = approveDto.approvedBy || userId;
    const approved = this.tasksService.approveTask(taskId, approvedBy);
    return this.toResponseDto(approved);
  }

  @Post(':taskId/cancel')
  cancelTask(
    @Param('taskId') taskId: string,
    @Body() cancelDto: CancelTaskDto,
    @Request() req: RequestWithUser,
  ): TaskResponseDto {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }

    const task = this.tasksService.findById(taskId);
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    // Verify ownership
    if (task.userId !== userId) {
      throw new BadRequestException('Unauthorized to cancel this task');
    }

    const canceled = this.tasksService.cancelTask(
      taskId,
      cancelDto.cancelReason,
    );
    return this.toResponseDto(canceled);
  }

  @Post(':taskId/execute')
  async executeTask(
    @Param('taskId') taskId: string,
  ): Promise<TaskResponseDto> {
    const task = await this.transferExecutionService.executeTransfer(taskId);
    return this.toResponseDto(task);
  }

  private toResponseDto(task: any): TaskResponseDto {
    return {
      taskId: task.taskId,
      userId: task.userId,
      sourceDeviceId: task.sourceDeviceId,
      targetDeviceId: task.targetDeviceId,
      actionType: task.actionType,
      actionPayload: task.actionPayload,
      state: task.state,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      expiresAt: task.expiresAt,
      approvedAt: task.approvedAt,
      approvedBy: task.approvedBy,
      canceledAt: task.canceledAt,
      cancelReason: task.cancelReason,
      failureReason: task.failureReason,
      completedAt: task.completedAt,
      transferResult: task.transferResult,
    };
  }
}
