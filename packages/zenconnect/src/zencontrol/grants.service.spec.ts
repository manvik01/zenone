import { Test, TestingModule } from '@nestjs/testing';
import { GrantsService } from './grants.service';
import { DevicesService } from '../devices/devices.service';
import { ResourceType, Capability } from '../common/dto/zencontrol.dto';
import { TrustStatus } from '../common/dto/device.dto';

describe('GrantsService', () => {
  let service: GrantsService;
  let devicesService: DevicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrantsService,
        {
          provide: DevicesService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GrantsService>(GrantsService);
    devicesService = module.get<DevicesService>(DevicesService);
  });

  describe('createGrant', () => {
    it('should create a grant successfully', () => {
      const userId = 'user-123';
      const createDto = {
        deviceId: 'device-123',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.READ, Capability.TRANSFER],
      };

      const grant = service.createGrant(userId, createDto);

      expect(grant).toBeDefined();
      expect(grant.userId).toBe(userId);
      expect(grant.deviceId).toBe(createDto.deviceId);
      expect(grant.resourceType).toBe(createDto.resourceType);
      expect(grant.resourcePath).toBe(createDto.resourcePath);
      expect(grant.capabilities).toEqual(createDto.capabilities);
      expect(grant.revokedAt).toBeUndefined();
      expect(grant.expiresAt).toBeUndefined();
    });

    it('should create a grant with expiry', () => {
      const userId = 'user-123';
      const expiresAt = new Date(Date.now() + 3600000);
      const createDto = {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.READ],
        expiresAt,
      };

      const grant = service.createGrant(userId, createDto);

      expect(grant.expiresAt).toEqual(expiresAt);
    });
  });

  describe('findByUserId', () => {
    it('should return all grants for a user', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-1',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/docs',
        capabilities: [Capability.READ],
      });
      service.createGrant(userId, {
        deviceId: 'device-2',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.TRANSFER],
      });

      const grants = service.findByUserId(userId);

      expect(grants).toHaveLength(2);
      expect(grants.every(g => g.userId === userId)).toBe(true);
    });

    it('should return empty array for user with no grants', () => {
      const grants = service.findByUserId('user-unknown');
      expect(grants).toEqual([]);
    });
  });

  describe('revokeGrant', () => {
    it('should revoke a grant', () => {
      const userId = 'user-123';
      const grant = service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/docs',
        capabilities: [Capability.READ],
      });

      const revoked = service.revokeGrant(grant.grantId);

      expect(revoked.revokedAt).toBeDefined();
      expect(revoked.revokedAt).toBeInstanceOf(Date);
    });

    it('should throw error when revoking non-existent grant', () => {
      expect(() => service.revokeGrant('non-existent')).toThrow('Grant not found');
    });
  });

  describe('checkGrant', () => {
    beforeEach(() => {
      jest.spyOn(devicesService, 'findById').mockReturnValue({
        deviceId: 'device-123',
        userId: 'user-123',
        trustStatus: TrustStatus.TRUSTED,
        platform: 'ANDROID' as any,
        deviceName: 'Test Device',
        publicKey: 'key',
        capabilities: [],
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should grant access for valid grant with exact path match', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.READ, Capability.TRANSFER],
      });

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/file.txt',
        Capability.READ,
      );

      expect(result.granted).toBe(true);
    });

    it('should grant access for file within granted folder', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.READ, Capability.TRANSFER],
      });

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/documents/file.txt',
        Capability.READ,
      );

      expect(result.granted).toBe(true);
    });

    it('should grant access for nested file within granted folder', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.TRANSFER],
      });

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/documents/subfolder/file.txt',
        Capability.TRANSFER,
      );

      expect(result.granted).toBe(true);
    });

    it('should deny access for file outside granted folder', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.READ],
      });

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/other/file.txt',
        Capability.READ,
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('No matching grant found');
    });

    it('should deny access when capability not in grant', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.READ],
      });

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/file.txt',
        Capability.WRITE,
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('No matching grant found');
    });

    it('should deny access for revoked grant', () => {
      const userId = 'user-123';
      const grant = service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.READ],
      });
      service.revokeGrant(grant.grantId);

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/file.txt',
        Capability.READ,
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('revoked');
    });

    it('should deny access for expired grant', () => {
      const userId = 'user-123';
      const pastDate = new Date(Date.now() - 1000);
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.READ],
        expiresAt: pastDate,
      });

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/file.txt',
        Capability.READ,
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should deny access when device is revoked', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.READ],
      });

      jest.spyOn(devicesService, 'findById').mockReturnValue({
        deviceId: 'device-123',
        userId: 'user-123',
        trustStatus: TrustStatus.REVOKED,
        platform: 'ANDROID' as any,
        deviceName: 'Test Device',
        publicKey: 'key',
        capabilities: [],
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/file.txt',
        Capability.READ,
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('Device is not trusted');
    });

    it('should deny access when device is not found', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FILE_PATH,
        resourcePath: '/home/user/file.txt',
        capabilities: [Capability.READ],
      });

      jest.spyOn(devicesService, 'findById').mockReturnValue(null);

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/file.txt',
        Capability.READ,
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('Device not found');
    });

    it('should prevent path traversal attacks', () => {
      const userId = 'user-123';
      service.createGrant(userId, {
        deviceId: 'device-123',
        resourceType: ResourceType.FOLDER_PATH,
        resourcePath: '/home/user/documents',
        capabilities: [Capability.READ],
      });

      const result = service.checkGrant(
        userId,
        'device-123',
        ResourceType.FILE_PATH,
        '/home/user/documents/../secrets/file.txt',
        Capability.READ,
      );

      expect(result.granted).toBe(false);
    });
  });
});
