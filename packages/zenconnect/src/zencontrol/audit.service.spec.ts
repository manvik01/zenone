import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { ResourceType, Capability, AuditResult } from '../common/dto/zencontrol.dto';

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('recordCheck', () => {
    it('should record a granted audit entry', () => {
      const entry = service.recordCheck({
        userId: 'user-123',
        deviceId: 'device-123',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.READ,
        result: AuditResult.GRANTED,
      });

      expect(entry).toBeDefined();
      expect(entry.auditId).toBeDefined();
      expect(entry.userId).toBe('user-123');
      expect(entry.deviceId).toBe('device-123');
      expect(entry.result).toBe(AuditResult.GRANTED);
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should record a denied audit entry with reason', () => {
      const entry = service.recordCheck({
        userId: 'user-123',
        deviceId: 'device-123',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.WRITE,
        result: AuditResult.DENIED,
        reason: 'No matching grant found',
      });

      expect(entry.result).toBe(AuditResult.DENIED);
      expect(entry.reason).toBe('No matching grant found');
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Create some audit entries
      service.recordCheck({
        userId: 'user-123',
        deviceId: 'device-1',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file1.txt',
        capability: Capability.READ,
        result: AuditResult.GRANTED,
      });

      service.recordCheck({
        userId: 'user-123',
        deviceId: 'device-1',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file2.txt',
        capability: Capability.WRITE,
        result: AuditResult.DENIED,
        reason: 'No grant',
      });

      service.recordCheck({
        userId: 'user-456',
        deviceId: 'device-2',
        action: 'check_grant',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/other/docs',
        capability: Capability.TRANSFER,
        result: AuditResult.GRANTED,
      });
    });

    it('should query all entries when no filters provided', () => {
      const entries = service.query({});
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by userId', () => {
      const entries = service.query({ userId: 'user-123' });
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.userId === 'user-123')).toBe(true);
    });

    it('should filter by deviceId', () => {
      const entries = service.query({ deviceId: 'device-1' });
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.deviceId === 'device-1')).toBe(true);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const from = new Date(now.getTime() - 1000);
      const to = new Date(now.getTime() + 1000);

      const entries = service.query({ from, to });
      expect(entries.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for non-matching filters', () => {
      const entries = service.query({ userId: 'non-existent' });
      expect(entries).toEqual([]);
    });

    it('should limit results', () => {
      const entries = service.query({ limit: 2 });
      expect(entries).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const entries = service.query({
        userId: 'user-123',
        deviceId: 'device-1',
      });
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.userId === 'user-123' && e.deviceId === 'device-1')).toBe(true);
    });

    it('should sort entries by timestamp descending (newest first)', () => {
      const entries = service.query({});
      for (let i = 0; i < entries.length - 1; i++) {
        expect(entries[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          entries[i + 1].timestamp.getTime(),
        );
      }
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      service.recordCheck({
        userId: 'user-123',
        deviceId: 'device-1',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.READ,
        result: AuditResult.GRANTED,
      });

      service.recordCheck({
        userId: 'user-123',
        deviceId: 'device-1',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file2.txt',
        capability: Capability.WRITE,
        result: AuditResult.DENIED,
      });

      service.recordCheck({
        userId: 'user-123',
        deviceId: 'device-1',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file3.txt',
        capability: Capability.READ,
        result: AuditResult.GRANTED,
      });
    });

    it('should return correct statistics', () => {
      const stats = service.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.granted).toBeGreaterThanOrEqual(2);
      expect(stats.denied).toBeGreaterThanOrEqual(1);
    });
  });
});
