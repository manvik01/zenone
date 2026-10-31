import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Platform, TrustStatus } from '../common/dto/device.dto';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('DevicesController', () => {
  let controller: DevicesController;
  let service: DevicesService;

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
  };

  const mockDevice = {
    deviceId: 'device-123',
    userId: 'user-123',
    platform: Platform.ANDROID,
    deviceName: 'Test Device',
    publicKey: 'mock-key',
    capabilities: ['file_transfer'],
    lastSeen: new Date(),
    trustStatus: TrustStatus.TRUSTED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequest = {
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        DevicesService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DevicesController>(DevicesController);
    service = module.get<DevicesService>(DevicesService);
  });

  describe('startPairing', () => {
    it('should initiate device pairing', () => {
      const pairDto = {
        deviceName: 'New Device',
        platform: Platform.ANDROID,
        publicKey: 'new-key',
        capabilities: ['file_transfer'],
      };

      const result = controller.startPairing(mockRequest as any, pairDto);

      expect(result).toHaveProperty('deviceId');
      expect(result).toHaveProperty('pairingCode');
      expect(result).toHaveProperty('expiresAt');
    });

    it('should use authenticated user ID', () => {
      const pairDto = {
        deviceName: 'New Device',
        platform: Platform.ANDROID,
        publicKey: 'new-key',
        capabilities: ['file_transfer'],
      };

      const { deviceId } = controller.startPairing(mockRequest as any, pairDto);
      const device = service.findById(deviceId);

      expect(device?.userId).toBe(mockUser.userId);
    });
  });

  describe('confirmPairing', () => {
    it('should confirm pairing with valid code', () => {
      const pairDto = {
        deviceName: 'New Device',
        platform: Platform.ANDROID,
        publicKey: 'new-key',
        capabilities: ['file_transfer'],
      };

      const { deviceId, pairingCode } = controller.startPairing(
        mockRequest as any,
        pairDto
      );

      const result = controller.confirmPairing(
        mockRequest as any,
        deviceId,
        { pairingCode }
      );

      expect(result.deviceId).toBe(deviceId);
      expect(result.trustStatus).toBe(TrustStatus.TRUSTED);
    });

    it('should throw error for invalid code', () => {
      const pairDto = {
        deviceName: 'New Device',
        platform: Platform.ANDROID,
        publicKey: 'new-key',
        capabilities: ['file_transfer'],
      };

      const { deviceId } = controller.startPairing(mockRequest as any, pairDto);

      expect(() => {
        controller.confirmPairing(mockRequest as any, deviceId, {
          pairingCode: '000000',
        });
      }).toThrow('Invalid pairing code');
    });

    it('should only allow device owner to confirm', () => {
      const pairDto = {
        deviceName: 'New Device',
        platform: Platform.ANDROID,
        publicKey: 'new-key',
        capabilities: ['file_transfer'],
      };

      const { deviceId, pairingCode } = controller.startPairing(
        mockRequest as any,
        pairDto
      );

      const otherUserRequest = {
        user: { userId: 'other-user', email: 'other@example.com' },
      };

      expect(() => {
        controller.confirmPairing(otherUserRequest as any, deviceId, {
          pairingCode,
        });
      }).toThrow(ForbiddenException);
    });
  });

  describe('listDevices', () => {
    it('should return only authenticated user devices', () => {
      controller.startPairing(mockRequest as any, {
        deviceName: 'Device 1',
        platform: Platform.ANDROID,
        publicKey: 'key1',
        capabilities: ['file_transfer'],
      });

      controller.startPairing(mockRequest as any, {
        deviceName: 'Device 2',
        platform: Platform.WINDOWS,
        publicKey: 'key2',
        capabilities: ['file_transfer'],
      });

      const otherUserRequest = {
        user: { userId: 'other-user', email: 'other@example.com' },
      };

      controller.startPairing(otherUserRequest as any, {
        deviceName: 'Other Device',
        platform: Platform.ANDROID,
        publicKey: 'key3',
        capabilities: ['file_transfer'],
      });

      const devices = controller.listDevices(mockRequest as any);

      expect(devices).toHaveLength(2);
      expect(devices[0].deviceName).toBe('Device 1');
      expect(devices[1].deviceName).toBe('Device 2');
    });

    it('should include isOnline status in response', () => {
      const { deviceId, pairingCode } = controller.startPairing(
        mockRequest as any,
        {
          deviceName: 'Device 1',
          platform: Platform.ANDROID,
          publicKey: 'key1',
          capabilities: ['file_transfer'],
        }
      );

      controller.confirmPairing(mockRequest as any, deviceId, { pairingCode });

      const devices = controller.listDevices(mockRequest as any);

      expect(devices[0]).toHaveProperty('isOnline');
      expect(devices[0].isOnline).toBe(true);
    });
  });

  describe('getDevice', () => {
    it('should return device details for owner', () => {
      const { deviceId } = controller.startPairing(mockRequest as any, {
        deviceName: 'My Device',
        platform: Platform.ANDROID,
        publicKey: 'key1',
        capabilities: ['file_transfer'],
      });

      const device = controller.getDevice(mockRequest as any, deviceId);

      expect(device.deviceId).toBe(deviceId);
      expect(device.deviceName).toBe('My Device');
    });

    it('should throw ForbiddenException for non-owner', () => {
      const { deviceId } = controller.startPairing(mockRequest as any, {
        deviceName: 'My Device',
        platform: Platform.ANDROID,
        publicKey: 'key1',
        capabilities: ['file_transfer'],
      });

      const otherUserRequest = {
        user: { userId: 'other-user', email: 'other@example.com' },
      };

      expect(() => {
        controller.getDevice(otherUserRequest as any, deviceId);
      }).toThrow(ForbiddenException);
    });

    it('should throw error for non-existent device', () => {
      expect(() => {
        controller.getDevice(mockRequest as any, 'fake-device-id');
      }).toThrow('Device not found');
    });
  });

  describe('updatePresence', () => {
    it('should update device presence', () => {
      const { deviceId, pairingCode } = controller.startPairing(
        mockRequest as any,
        {
          deviceName: 'My Device',
          platform: Platform.ANDROID,
          publicKey: 'key1',
          capabilities: ['file_transfer'],
        }
      );

      controller.confirmPairing(mockRequest as any, deviceId, { pairingCode });

      const originalDevice = service.findById(deviceId);
      const originalLastSeen = originalDevice?.lastSeen;

      jest.useFakeTimers();
      jest.advanceTimersByTime(5000);

      controller.updatePresence(mockRequest as any, deviceId);

      const updatedDevice = service.findById(deviceId);

      expect(updatedDevice?.lastSeen.getTime()).toBeGreaterThan(
        originalLastSeen!.getTime()
      );

      jest.useRealTimers();
    });

    it('should only allow owner to update presence', () => {
      const { deviceId } = controller.startPairing(mockRequest as any, {
        deviceName: 'My Device',
        platform: Platform.ANDROID,
        publicKey: 'key1',
        capabilities: ['file_transfer'],
      });

      const otherUserRequest = {
        user: { userId: 'other-user', email: 'other@example.com' },
      };

      expect(() => {
        controller.updatePresence(otherUserRequest as any, deviceId);
      }).toThrow(ForbiddenException);
    });
  });

  describe('revokeDevice', () => {
    it('should revoke device for owner', () => {
      const { deviceId, pairingCode } = controller.startPairing(
        mockRequest as any,
        {
          deviceName: 'My Device',
          platform: Platform.ANDROID,
          publicKey: 'key1',
          capabilities: ['file_transfer'],
        }
      );

      controller.confirmPairing(mockRequest as any, deviceId, { pairingCode });
      controller.revokeDevice(mockRequest as any, deviceId);

      const device = service.findById(deviceId);

      expect(device?.trustStatus).toBe(TrustStatus.REVOKED);
    });

    it('should only allow owner to revoke', () => {
      const { deviceId } = controller.startPairing(mockRequest as any, {
        deviceName: 'My Device',
        platform: Platform.ANDROID,
        publicKey: 'key1',
        capabilities: ['file_transfer'],
      });

      const otherUserRequest = {
        user: { userId: 'other-user', email: 'other@example.com' },
      };

      expect(() => {
        controller.revokeDevice(otherUserRequest as any, deviceId);
      }).toThrow(ForbiddenException);
    });

    it('should throw error for non-existent device', () => {
      expect(() => {
        controller.revokeDevice(mockRequest as any, 'fake-device-id');
      }).toThrow('Device not found');
    });
  });
});
