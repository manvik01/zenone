import { Test, TestingModule } from '@nestjs/testing';
import { ZenControlController } from './zencontrol.controller';
import { GrantsService } from './grants.service';
import { AuditService } from './audit.service';
import { ResourceType, Capability, AuditResult } from '../common/dto/zencontrol.dto';

describe('ZenControlController', () => {
  let controller: ZenControlController;
  let grantsService: GrantsService;
  let auditService: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZenControlController],
      providers: [
        {
          provide: GrantsService,
          useValue: {
            createGrant: jest.fn(),
            findByUserId: jest.fn(),
            revokeGrant: jest.fn(),
            checkGrant: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            recordCheck: jest.fn(),
            query: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ZenControlController>(ZenControlController);
    grantsService = module.get<GrantsService>(GrantsService);
    auditService = module.get<AuditService>(AuditService);
  });

  describe('createGrant', () => {
    it('should create a grant and return GrantResponseDto', async () => {
      const req = { user: { userId: 'user-123' } };
      const createDto = {
        deviceId: 'device-123',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.READ, Capability.TRANSFER],
      };

      const mockGrant = {
        grantId: 'grant-123',
        userId: 'user-123',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(grantsService, 'createGrant').mockReturnValue(mockGrant);

      const result = await controller.createGrant(req, createDto);

      expect(result.grantId).toBe('grant-123');
      expect(result.deviceId).toBe('device-123');
      expect(grantsService.createGrant).toHaveBeenCalledWith('user-123', createDto);
    });
  });

  describe('listGrants', () => {
    it('should list all grants for authenticated user', async () => {
      const req = { user: { userId: 'user-123' } };
      const mockGrants = [
        {
          grantId: 'grant-1',
          userId: 'user-123',
          deviceId: 'device-1',
          resourceType: ResourceType.FILE_PATH,
          resourcePath: '/home/user/file.txt',
          capabilities: [Capability.READ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      jest.spyOn(grantsService, 'findByUserId').mockReturnValue(mockGrants);

      const result = await controller.listGrants(req);

      expect(result).toHaveLength(1);
      expect(grantsService.findByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  describe('revokeGrant', () => {
    it('should revoke a grant and return updated grant', async () => {
      const mockGrant = {
        grantId: 'grant-123',
        userId: 'user-123',
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.READ],
        revokedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(grantsService, 'revokeGrant').mockReturnValue(mockGrant);

      const result = await controller.revokeGrant('grant-123');

      expect(result.revokedAt).toBeDefined();
      expect(grantsService.revokeGrant).toHaveBeenCalledWith('grant-123');
    });
  });

  describe('checkGrant', () => {
    it('should check grant and record audit entry when granted', async () => {
      const req = { user: { userId: 'user-123' } };
      const checkDto = {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.READ,
      };

      const checkResult = { granted: true };
      jest.spyOn(grantsService, 'checkGrant').mockReturnValue(checkResult);

      const auditEntry = {
        auditId: 'audit-123',
        timestamp: new Date(),
        userId: 'user-123',
        deviceId: 'device-123',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.READ,
        result: AuditResult.GRANTED,
      };
      jest.spyOn(auditService, 'recordCheck').mockReturnValue(auditEntry);

      const result = await controller.checkGrant(req, checkDto);

      expect(result.granted).toBe(true);
      expect(grantsService.checkGrant).toHaveBeenCalledWith(
        'user-123',
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/file.txt',
        Capability.READ,
      );
      expect(auditService.recordCheck).toHaveBeenCalledWith({
        userId: 'user-123',
        deviceId: 'device-123',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.READ,
        result: AuditResult.GRANTED,
      });
    });

    it('should check grant and record audit entry when denied', async () => {
      const req = { user: { userId: 'user-123' } };
      const checkDto = {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.WRITE,
      };

      const checkResult = { granted: false, reason: 'No matching grant' };
      jest.spyOn(grantsService, 'checkGrant').mockReturnValue(checkResult);

      const auditEntry = {
        auditId: 'audit-123',
        timestamp: new Date(),
        userId: 'user-123',
        deviceId: 'device-123',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.WRITE,
        result: AuditResult.DENIED,
        reason: 'No matching grant',
      };
      jest.spyOn(auditService, 'recordCheck').mockReturnValue(auditEntry);

      const result = await controller.checkGrant(req, checkDto);

      expect(result.granted).toBe(false);
      expect(result.reason).toBe('No matching grant');
      expect(auditService.recordCheck).toHaveBeenCalledWith({
        userId: 'user-123',
        deviceId: 'device-123',
        action: 'check_grant',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capability: Capability.WRITE,
        result: AuditResult.DENIED,
        reason: 'No matching grant',
      });
    });
  });

  describe('queryAudit', () => {
    it('should query audit log with filters', async () => {
      const mockEntries = [
        {
          auditId: 'audit-1',
          timestamp: new Date(),
          userId: 'user-123',
          deviceId: 'device-123',
          action: 'check_grant',
          resourceType: ResourceType.FILE_PATH,
          resourcePath: '/home/user/file.txt',
          capability: Capability.READ,
          result: AuditResult.GRANTED,
        },
      ];

      jest.spyOn(auditService, 'query').mockReturnValue(mockEntries);

      const result = await controller.queryAudit({
        userId: 'user-123',
      });

      expect(result).toHaveLength(1);
      expect(auditService.query).toHaveBeenCalledWith({ userId: 'user-123' });
    });
  });

  describe('getAuditStats', () => {
    it('should return audit statistics', async () => {
      const mockStats = { total: 10, granted: 7, denied: 3 };
      jest.spyOn(auditService, 'getStats').mockReturnValue(mockStats);

      const result = await controller.getAuditStats();

      expect(result).toEqual(mockStats);
      expect(auditService.getStats).toHaveBeenCalled();
    });
  });
});
