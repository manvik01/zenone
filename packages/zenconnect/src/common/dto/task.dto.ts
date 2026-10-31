import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';

export enum TaskState {
  QUEUED = 'QUEUED',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
}

export enum ActionType {
  TRANSFER_FILE = 'transfer_file',
  SUMMARIZE = 'summarize',
  LIST_DEVICES = 'list_devices',
  TASK_STATUS = 'task_status',
}

export class CreateTaskDto {
  @IsString()
  sourceDeviceId: string;

  @IsString()
  targetDeviceId: string;

  @IsEnum(ActionType)
  actionType: ActionType;

  @IsObject()
  actionPayload: any;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export interface TransferResult {
  actualDigest?: string;
  actualByteCount?: number;
  sourceGrantChecked: boolean;
  targetGrantChecked: boolean;
  error?: string;
}

export class Task {
  taskId: string;
  userId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  actionType: ActionType;
  actionPayload: any;
  state: TaskState;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  canceledAt?: Date;
  cancelReason?: string;
  failureReason?: string;
  completedAt?: Date;
  transferResult?: TransferResult;
}

export class TaskResponseDto {
  taskId: string;
  userId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  actionType: ActionType;
  actionPayload: any;
  state: TaskState;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  canceledAt?: Date;
  cancelReason?: string;
  failureReason?: string;
  completedAt?: Date;
  transferResult?: TransferResult;
}

export class ApproveTaskDto {
  @IsString()
  @IsOptional()
  approvedBy?: string;
}

export class CancelTaskDto {
  @IsString()
  @IsOptional()
  cancelReason?: string;
}

export class ListTasksQueryDto {
  @IsEnum(TaskState)
  @IsOptional()
  state?: TaskState;

  @IsEnum(ActionType)
  @IsOptional()
  actionType?: ActionType;

  @IsString()
  @IsOptional()
  deviceId?: string;
}
