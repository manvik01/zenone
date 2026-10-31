import { IsString, IsEnum, IsArray, IsOptional } from 'class-validator';

export enum Platform {
  ANDROID = 'ANDROID',
  WINDOWS = 'WINDOWS',
  IOS = 'IOS',
  MACOS = 'MACOS',
}

export enum TrustStatus {
  PENDING = 'PENDING',
  TRUSTED = 'TRUSTED',
  REVOKED = 'REVOKED',
}

export class PairDeviceStartDto {
  @IsString()
  deviceName: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsString()
  publicKey: string;

  @IsArray()
  @IsString({ each: true })
  capabilities: string[];
}

export class PairDeviceConfirmDto {
  @IsString()
  pairingCode: string;
}

export class Device {
  deviceId: string;
  userId: string;
  platform: Platform;
  deviceName: string;
  publicKey: string;
  capabilities: string[];
  lastSeen: Date;
  trustStatus: TrustStatus;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class DeviceResponseDto {
  deviceId: string;
  platform: Platform;
  deviceName: string;
  capabilities: string[];
  lastSeen: Date;
  trustStatus: TrustStatus;
  isOnline: boolean;
  revokedAt?: Date;
  createdAt: Date;
}
