import { Injectable, UnauthorizedException } from '@nestjs/common';
import { GrantsService } from '../zencontrol/grants.service';
import { ResourceType, Capability } from '../common/dto/zencontrol.dto';

/**
 * Example integration showing how M5 Transfer will use ZenControl
 * This demonstrates the mandatory grant check before any file operation
 */
@Injectable()
export class TransferIntegrationExample {
  constructor(private readonly grantsService: GrantsService) {}

  /**
   * Example: Transfer a single file
   * MUST check grant before transfer
   */
  async transferFile(
    userId: string,
    deviceId: string,
    filePath: string,
  ): Promise<void> {
    // MANDATORY: Check grant before any file operation
    const grantCheck = this.grantsService.checkGrant(
      userId,
      deviceId,
      ResourceType.FILE_PATH,
      filePath,
      Capability.TRANSFER,
    );

    if (!grantCheck.granted) {
      throw new UnauthorizedException(
        `Transfer denied for ${filePath}: ${grantCheck.reason}`,
      );
    }

    // Grant check passed - proceed with transfer
    // ... actual transfer logic here ...
    console.log(`Transfer authorized for ${filePath}`);
  }

  /**
   * Example: Transfer multiple files
   * MUST check each file individually
   */
  async transferMultipleFiles(
    userId: string,
    deviceId: string,
    filePaths: string[],
  ): Promise<{ authorized: string[]; denied: string[] }> {
    const authorized: string[] = [];
    const denied: string[] = [];

    // Check each file path individually
    for (const filePath of filePaths) {
      const grantCheck = this.grantsService.checkGrant(
        userId,
        deviceId,
        ResourceType.FILE_PATH,
        filePath,
        Capability.TRANSFER,
      );

      if (grantCheck.granted) {
        authorized.push(filePath);
      } else {
        denied.push(filePath);
      }
    }

    // Only transfer authorized files
    for (const filePath of authorized) {
      // ... actual transfer logic here ...
      console.log(`Transferring ${filePath}`);
    }

    return { authorized, denied };
  }

  /**
   * Example: Read file contents
   * Shows different capability check (READ instead of TRANSFER)
   */
  async readFile(
    userId: string,
    deviceId: string,
    filePath: string,
  ): Promise<Buffer> {
    // Check READ capability
    const grantCheck = this.grantsService.checkGrant(
      userId,
      deviceId,
      ResourceType.FILE_PATH,
      filePath,
      Capability.READ,
    );

    if (!grantCheck.granted) {
      throw new UnauthorizedException(
        `Read denied for ${filePath}: ${grantCheck.reason}`,
      );
    }

    // ... actual read logic here ...
    return Buffer.from('file contents');
  }

  /**
   * Example: List folder contents
   * Shows folder-level permission check
   */
  async listFolder(
    userId: string,
    deviceId: string,
    folderPath: string,
  ): Promise<string[]> {
    // Check LIST capability on folder
    const grantCheck = this.grantsService.checkGrant(
      userId,
      deviceId,
      ResourceType.FOLDER_PATH,
      folderPath,
      Capability.LIST,
    );

    if (!grantCheck.granted) {
      throw new UnauthorizedException(
        `List denied for ${folderPath}: ${grantCheck.reason}`,
      );
    }

    // ... actual list logic here ...
    return ['file1.txt', 'file2.txt', 'subfolder'];
  }
}
