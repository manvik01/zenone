import { IsString, IsNumber, IsEnum } from 'class-validator';

export enum TransferStatus {
  PENDING = 'PENDING',
  UPLOADING = 'UPLOADING',
  RELAYING = 'RELAYING',
  DOWNLOADING = 'DOWNLOADING',
  VERIFYING = 'VERIFYING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class CreateTransferDto {
  @IsString()
  taskId: string;

  @IsString()
  sourceDeviceId: string;

  @IsString()
  destinationDeviceId: string;

  @IsString()
  fileDigest: string;

  @IsNumber()
  byteCount: number;
}

export class Transfer {
  transferId: string;
  taskId: string;
  sourceDeviceId: string;
  destinationDeviceId: string;
  fileDigest: string;
  byteCount: number;
  status: TransferStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class TransferResponseDto {
  transferId: string;
  taskId: string;
  sourceDeviceId: string;
  destinationDeviceId: string;
  fileDigest: string;
  byteCount: number;
  status: TransferStatus;
  createdAt: Date;
}
