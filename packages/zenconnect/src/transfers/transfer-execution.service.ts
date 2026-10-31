import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TasksService } from '../tasks/tasks.service';
import { GrantsService } from '../zencontrol/grants.service';
import { AuditService } from '../zencontrol/audit.service';
import { Task, TaskState, ActionType, TransferResult } from '../common/dto/task.dto';
import { ResourceType, Capability, AuditResult } from '../common/dto/zencontrol.dto';

@Injectable()
export class TransferExecutionService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly grantsService: GrantsService,
    private readonly auditService: AuditService,
  ) {}

  async executeTransfer(taskId: string): Promise<Task> {
    const task = this.tasksService.findById(taskId);
    
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    if (task.actionType !== ActionType.TRANSFER_FILE) {
      throw new BadRequestException('Task is not a transfer_file action');
    }

    if (task.state !== TaskState.APPROVED) {
      throw new BadRequestException(
        `Task must be in APPROVED state to execute, current state: ${task.state}`
      );
    }

    // Transition to EXECUTING state
    this.tasksService.executeTask(taskId);

    try {
      // Step 1: Validate ACL for source path
      const sourceGrantResult = this.grantsService.checkGrant(
        task.userId,
        task.sourceDeviceId,
        ResourceType.FILE_PATH,
        task.actionPayload.sourcePath,
        Capability.TRANSFER,
      );

      // Record source grant check in audit
      this.auditService.recordCheck({
        userId: task.userId,
        deviceId: task.sourceDeviceId,
        action: 'transfer_file',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: task.actionPayload.sourcePath,
        capability: Capability.TRANSFER,
        result: sourceGrantResult.granted ? AuditResult.GRANTED : AuditResult.DENIED,
        reason: sourceGrantResult.reason,
      });

      if (!sourceGrantResult.granted) {
        const failureReason = `Access denied for source path: ${sourceGrantResult.reason}`;
        const transferResult: TransferResult = {
          sourceGrantChecked: true,
          targetGrantChecked: false,
          error: failureReason,
        };
        
        this.tasksService.failTask(taskId, failureReason, transferResult);
        return this.tasksService.findById(taskId);
      }

      // Step 2: Validate ACL for target path
      const targetGrantResult = this.grantsService.checkGrant(
        task.userId,
        task.targetDeviceId,
        ResourceType.FILE_PATH,
        task.actionPayload.targetPath,
        Capability.TRANSFER,
      );

      // Record target grant check in audit
      this.auditService.recordCheck({
        userId: task.userId,
        deviceId: task.targetDeviceId,
        action: 'transfer_file',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: task.actionPayload.targetPath,
        capability: Capability.TRANSFER,
        result: targetGrantResult.granted ? AuditResult.GRANTED : AuditResult.DENIED,
        reason: targetGrantResult.reason,
      });

      if (!targetGrantResult.granted) {
        const failureReason = `Access denied for target path: ${targetGrantResult.reason}`;
        const transferResult: TransferResult = {
          sourceGrantChecked: true,
          targetGrantChecked: true,
          error: failureReason,
        };
        
        this.tasksService.failTask(taskId, failureReason, transferResult);
        return this.tasksService.findById(taskId);
      }

      // Step 3: Perform stub transfer
      const transferOutcome = await this.performStubTransfer(task);

      // Step 4: Validate digest
      if (transferOutcome.actualDigest !== task.actionPayload.expectedDigest) {
        const failureReason = `Digest mismatch: expected ${task.actionPayload.expectedDigest}, got ${transferOutcome.actualDigest}`;
        const transferResult: TransferResult = {
          actualDigest: transferOutcome.actualDigest,
          actualByteCount: transferOutcome.actualByteCount,
          sourceGrantChecked: true,
          targetGrantChecked: true,
          error: failureReason,
        };
        
        this.tasksService.failTask(taskId, failureReason, transferResult);
        return this.tasksService.findById(taskId);
      }

      // Step 5: Validate byte count
      if (transferOutcome.actualByteCount !== task.actionPayload.expectedByteCount) {
        const failureReason = `Byte count mismatch: expected ${task.actionPayload.expectedByteCount}, got ${transferOutcome.actualByteCount}`;
        const transferResult: TransferResult = {
          actualDigest: transferOutcome.actualDigest,
          actualByteCount: transferOutcome.actualByteCount,
          sourceGrantChecked: true,
          targetGrantChecked: true,
          error: failureReason,
        };
        
        this.tasksService.failTask(taskId, failureReason, transferResult);
        return this.tasksService.findById(taskId);
      }

      // Step 6: All validations passed - mark as SUCCEEDED
      const transferResult: TransferResult = {
        actualDigest: transferOutcome.actualDigest,
        actualByteCount: transferOutcome.actualByteCount,
        sourceGrantChecked: true,
        targetGrantChecked: true,
      };

      // Record successful transfer in audit
      this.auditService.recordCheck({
        userId: task.userId,
        deviceId: task.sourceDeviceId,
        action: 'transfer_completed',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: task.actionPayload.sourcePath,
        capability: Capability.TRANSFER,
        result: AuditResult.GRANTED,
      });

      this.tasksService.completeTask(taskId, transferResult);
      return this.tasksService.findById(taskId);

    } catch (error) {
      // Handle any unexpected errors
      const failureReason = error.message || 'Transfer execution failed';
      const transferResult: TransferResult = {
        sourceGrantChecked: false,
        targetGrantChecked: false,
        error: failureReason,
      };
      
      this.tasksService.failTask(taskId, failureReason, transferResult);
      return this.tasksService.findById(taskId);
    }
  }

  private async performStubTransfer(task: Task): Promise<{
    actualDigest: string;
    actualByteCount: number;
  }> {
    // Simulate transfer delay
    await this.delay(100 + Math.random() * 100);

    // Check for test fixture flags
    const payload = task.actionPayload;

    // For digest mismatch test scenario
    if (payload.__testSimulateDigestMismatch) {
      return {
        actualDigest: 'wrong-digest-hash',
        actualByteCount: payload.expectedByteCount,
      };
    }

    // For byte count mismatch test scenario
    if (payload.__testSimulateByteCountMismatch) {
      return {
        actualDigest: payload.expectedDigest,
        actualByteCount: 5678, // Different from expected
      };
    }

    // Default stub behavior: return matching values for success path
    return {
      actualDigest: payload.expectedDigest,
      actualByteCount: payload.expectedByteCount,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
