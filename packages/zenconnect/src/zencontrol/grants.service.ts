import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { DevicesService } from '../devices/devices.service';
import {
  Grant,
  CreateGrantDto,
  ResourceType,
  Capability,
  CheckGrantResult,
} from '../common/dto/zencontrol.dto';
import { TrustStatus } from '../common/dto/device.dto';

@Injectable()
export class GrantsService {
  private grants: Map<string, Grant> = new Map();

  constructor(private readonly devicesService: DevicesService) {}

  createGrant(userId: string, createDto: CreateGrantDto): Grant {
    const grantId = uuidv4();

    const grant: Grant = {
      grantId,
      userId,
      deviceId: createDto.deviceId,
      resourceType: createDto.resourceType,
      resourcePath: this.normalizePath(createDto.resourcePath),
      capabilities: createDto.capabilities,
      expiresAt: createDto.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.grants.set(grantId, grant);
    return grant;
  }

  findByUserId(userId: string): Grant[] {
    return Array.from(this.grants.values()).filter(
      (grant) => grant.userId === userId,
    );
  }

  findById(grantId: string): Grant | null {
    return this.grants.get(grantId) || null;
  }

  revokeGrant(grantId: string): Grant {
    const grant = this.grants.get(grantId);
    if (!grant) {
      throw new Error('Grant not found');
    }

    grant.revokedAt = new Date();
    grant.updatedAt = new Date();
    this.grants.set(grantId, grant);

    return grant;
  }

  checkGrant(
    userId: string,
    deviceId: string,
    resourceType: ResourceType,
    resourcePath: string,
    capability: Capability,
  ): CheckGrantResult {
    // Validate device first
    const device = this.devicesService.findById(deviceId);
    if (!device) {
      return {
        granted: false,
        reason: 'Device not found',
      };
    }

    if (device.trustStatus !== TrustStatus.TRUSTED) {
      return {
        granted: false,
        reason: 'Device is not trusted',
      };
    }

    // Normalize the requested path to prevent traversal attacks
    const normalizedPath = this.normalizePath(resourcePath);

    // Find matching grants for this user and device
    const userGrants = Array.from(this.grants.values()).filter(
      (grant) =>
        grant.userId === userId &&
        grant.deviceId === deviceId &&
        !grant.revokedAt,
    );

    // Check each grant
    for (const grant of userGrants) {
      // Skip expired grants
      if (grant.expiresAt && grant.expiresAt < new Date()) {
        continue;
      }

      // Check if capability is included
      if (!grant.capabilities.includes(capability)) {
        continue;
      }

      // Check path matching
      if (this.pathMatches(grant, resourceType, normalizedPath)) {
        return {
          granted: true,
        };
      }
    }

    // Check if any grant was found but expired or revoked
    const anyExpiredGrant = Array.from(this.grants.values()).find(
      (grant) =>
        grant.userId === userId &&
        grant.deviceId === deviceId &&
        grant.expiresAt &&
        grant.expiresAt < new Date() &&
        grant.capabilities.includes(capability) &&
        this.pathMatches(grant, resourceType, normalizedPath),
    );

    if (anyExpiredGrant) {
      return {
        granted: false,
        reason: 'Grant expired',
      };
    }

    const anyRevokedGrant = Array.from(this.grants.values()).find(
      (grant) =>
        grant.userId === userId &&
        grant.deviceId === deviceId &&
        grant.revokedAt &&
        grant.capabilities.includes(capability) &&
        this.pathMatches(grant, resourceType, normalizedPath),
    );

    if (anyRevokedGrant) {
      return {
        granted: false,
        reason: 'Grant revoked',
      };
    }

    return {
      granted: false,
      reason: 'No matching grant found',
    };
  }

  private pathMatches(
    grant: Grant,
    resourceType: ResourceType,
    requestedPath: string,
  ): boolean {
    const grantPath = grant.resourcePath;

    // Exact match for file grants
    if (grant.resourceType === ResourceType.FILE_PATH) {
      return grantPath === requestedPath;
    }

    // For folder grants, check if requested path is within the folder
    if (grant.resourceType === ResourceType.FOLDER_PATH) {
      // Exact folder match
      if (resourceType === ResourceType.FOLDER_PATH && grantPath === requestedPath) {
        return true;
      }

      // File within folder
      if (resourceType === ResourceType.FILE_PATH) {
        // Ensure the folder path ends with separator for proper prefix matching
        const folderPrefix = grantPath.endsWith(path.sep) 
          ? grantPath 
          : grantPath + path.sep;
        return requestedPath.startsWith(folderPrefix);
      }
    }

    return false;
  }

  private normalizePath(filePath: string): string {
    // Normalize to prevent path traversal attacks
    // This resolves '..' and '.' components
    return path.normalize(filePath);
  }
}
