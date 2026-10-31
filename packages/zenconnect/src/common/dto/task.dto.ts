import { IsString, IsEnum, IsObject, IsOptional, IsDate } from 'class-validator';

export enum TaskStatus {
  CREATED = 'CREATED',
  VALIDATING = 'VALIDATING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ActionType {
  TRANSFER_FILE = 'TRANSFER_FILE',
  FIND_FILE = 'FIND_FILE',
  OPEN_FILE = 'OPEN_FILE',
  LIST_FILES = 'LIST_FILES',
}

export class CreateTaskDto {
  @IsString()
  executorDeviceId: string;

  @IsEnum(ActionType)
  actionType: ActionType;

  @IsObject()
  payload: any;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class Task {
  taskId: string;
  requesterDeviceId: string;
  executorDeviceId: string;
  actionType: ActionType;
  payload: any;
  idempotencyKey: string;
  status: TaskStatus;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
}

export class TaskResponseDto {
  taskId: string;
  requesterDeviceId: string;
  executorDeviceId: string;
  actionType: ActionType;
  status: TaskStatus;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
}
