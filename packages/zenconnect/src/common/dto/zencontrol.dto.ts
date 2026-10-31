import { IsString, IsEnum, IsArray, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export enum ResourceType {
  FILE_PATH = 'file_path',
  FOLDER_PATH = 'folder_path',
}

export enum Capability {
  READ = 'read',
  WRITE = 'write',
  TRANSFER = 'transfer',
  LIST = 'list',
}

export enum AuditResult {
  GRANTED = 'granted',
  DENIED = 'denied',
}

export class CreateGrantDto {
  @IsString()
  deviceId: string;

  @IsEnum(ResourceType)
  resourceType: ResourceType;

  @IsString()
  resourcePath: string;

  @IsArray()
  @IsEnum(Capability, { each: true })
  capabilities: Capability[];

  @IsOptional()
  @IsDateString()
  expiresAt?: Date;
}

export class Grant {
  grantId: string;
  userId: string;
  deviceId: string;
  resourceType: ResourceType;
  resourcePath: string;
  capabilities: Capability[];
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class GrantResponseDto {
  grantId: string;
  deviceId: string;
  resourceType: ResourceType;
  resourcePath: string;
  capabilities: Capability[];
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export class CheckGrantDto {
  @IsString()
  deviceId: string;

  @IsEnum(ResourceType)
  resourceType: ResourceType;

  @IsString()
  resourcePath: string;

  @IsEnum(Capability)
  capability: Capability;
}

export class CheckGrantResult {
  granted: boolean;
  reason?: string;
}

export class AuditEntry {
  auditId: string;
  timestamp: Date;
  userId: string;
  deviceId: string;
  action: string;
  resourceType: ResourceType;
  resourcePath: string;
  capability: Capability;
  result: AuditResult;
  reason?: string;
}

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsDateString()
  from?: Date;

  @IsOptional()
  @IsDateString()
  to?: Date;

  @IsOptional()
  limit?: number;
}
