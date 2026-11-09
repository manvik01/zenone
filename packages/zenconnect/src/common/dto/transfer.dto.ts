import { IsString, IsNumber, IsEnum, IsNotEmpty } from 'class-validator';

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
  @IsNotEmpty()
  taskId: string;

  @IsString()
  @IsNotEmpty()
  sourceDeviceId: string;

  @IsString()
  @IsNotEmpty()
  destinationDeviceId: string;

  @IsString()
  @IsNotEmpty()
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
