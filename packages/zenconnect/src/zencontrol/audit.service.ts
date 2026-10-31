import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditEntry,
  AuditQueryDto,
  ResourceType,
  Capability,
  AuditResult,
} from '../common/dto/zencontrol.dto';

interface RecordCheckParams {
  userId: string;
  deviceId: string;
  action: string;
  resourceType: ResourceType;
  resourcePath: string;
  capability: Capability;
  result: AuditResult;
  reason?: string;
}

@Injectable()
export class AuditService {
  private auditLog: AuditEntry[] = [];

  recordCheck(params: RecordCheckParams): AuditEntry {
    const entry: AuditEntry = {
      auditId: uuidv4(),
      timestamp: new Date(),
      userId: params.userId,
      deviceId: params.deviceId,
      action: params.action,
      resourceType: params.resourceType,
      resourcePath: params.resourcePath,
      capability: params.capability,
      result: params.result,
      reason: params.reason,
    };

    this.auditLog.push(entry);
    return entry;
  }

  query(queryDto: AuditQueryDto): AuditEntry[] {
    let results = [...this.auditLog];

    // Filter by userId
    if (queryDto.userId) {
      results = results.filter((entry) => entry.userId === queryDto.userId);
    }

    // Filter by deviceId
    if (queryDto.deviceId) {
      results = results.filter((entry) => entry.deviceId === queryDto.deviceId);
    }

    // Filter by date range
    if (queryDto.from) {
      const fromDate = new Date(queryDto.from);
      results = results.filter((entry) => entry.timestamp >= fromDate);
    }

    if (queryDto.to) {
      const toDate = new Date(queryDto.to);
      results = results.filter((entry) => entry.timestamp <= toDate);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (queryDto.limit) {
      results = results.slice(0, queryDto.limit);
    }

    return results;
  }

  getStats(): { total: number; granted: number; denied: number } {
    const granted = this.auditLog.filter(
      (entry) => entry.result === AuditResult.GRANTED,
    ).length;
    const denied = this.auditLog.filter(
      (entry) => entry.result === AuditResult.DENIED,
    ).length;

    return {
      total: this.auditLog.length,
      granted,
      denied,
    };
  }
}
