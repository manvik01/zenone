import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { TrustStatus, Platform } from '../common/dto/device.dto';

describe('DevicesService', () => {
  let service: DevicesService;
  const mockUserId = 'user-123';
  const mockDeviceName = 'Test Device';
  const mockPlatform = Platform.ANDROID;
  const mockCapabilities = ['file_transfer', 'execute_tasks'];
  const mockPublicKey = 'mock-public-key';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DevicesService],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  describe('startPairing', () => {
    it('should initiate pairing and return pairing code', () => {
      const result = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      expect(result).toHaveProperty('deviceId');
      expect(result).toHaveProperty('pairingCode');
      expect(result).toHaveProperty('expiresAt');
      expect(result.pairingCode).toMatch(/^\d{6}$/);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should create device with PENDING trust status', () => {
      const { deviceId } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      const device = service.findById(deviceId);
      expect(device).toBeDefined();
      expect(device?.trustStatus).toBe(TrustStatus.PENDING);
      expect(device?.userId).toBe(mockUserId);
    });

    it('should set initial presence (lastSeen)', () => {
      const { deviceId } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      const device = service.findById(deviceId);
      expect(device?.lastSeen).toBeDefined();
      expect(device?.lastSeen.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('confirmPairing', () => {
    it('should confirm pairing with correct code', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      const device = service.confirmPairing(deviceId, pairingCode);

      expect(device.trustStatus).toBe(TrustStatus.TRUSTED);
      expect(device.deviceId).toBe(deviceId);
    });

    it('should throw error for invalid pairing code', () => {
      const { deviceId } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      expect(() => {
        service.confirmPairing(deviceId, '000000');
      }).toThrow('Invalid pairing code');
    });

    it('should throw error for non-existent device', () => {
      expect(() => {
        service.confirmPairing('fake-device-id', '123456');
      }).toThrow('No pairing challenge found');
    });

    it('should throw error for expired pairing code', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      jest.useFakeTimers();
      jest.advanceTimersByTime(6 * 60 * 1000);

      expect(() => {
        service.confirmPairing(deviceId, pairingCode);
      }).toThrow('Pairing code expired');

      jest.useRealTimers();
    });
  });

  describe('findByUserId', () => {
    it('should return all devices for a user', () => {
      const { deviceId: device1 } = service.startPairing(mockUserId, {
        deviceName: 'Device 1',
        platform: Platform.ANDROID,
        publicKey: 'key1',
        capabilities: mockCapabilities,
      });

      const { deviceId: device2 } = service.startPairing(mockUserId, {
        deviceName: 'Device 2',
        platform: Platform.WINDOWS,
        publicKey: 'key2',
        capabilities: mockCapabilities,
      });

      const devices = service.findByUserId(mockUserId);
      expect(devices).toHaveLength(2);
      expect(devices.map(d => d.deviceId)).toContain(device1);
      expect(devices.map(d => d.deviceId)).toContain(device2);
    });

    it('should not return other users devices', () => {
      service.startPairing(mockUserId, {
        deviceName: 'Device 1',
        platform: Platform.ANDROID,
        publicKey: 'key1',
        capabilities: mockCapabilities,
      });

      service.startPairing('other-user', {
        deviceName: 'Device 2',
        platform: Platform.WINDOWS,
        publicKey: 'key2',
        capabilities: mockCapabilities,
      });

      const devices = service.findByUserId(mockUserId);
      expect(devices).toHaveLength(1);
      expect(devices[0].userId).toBe(mockUserId);
    });

    it('should return empty array for user with no devices', () => {
      const devices = service.findByUserId('no-devices-user');
      expect(devices).toEqual([]);
    });
  });

  describe('revokeDevice', () => {
    it('should revoke a device', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      service.confirmPairing(deviceId, pairingCode);
      const revokedDevice = service.revokeDevice(deviceId);

      expect(revokedDevice.trustStatus).toBe(TrustStatus.REVOKED);
      expect(revokedDevice.revokedAt).toBeDefined();
    });

    it('should throw error when revoking non-existent device', () => {
      expect(() => {
        service.revokeDevice('fake-device-id');
      }).toThrow('Device not found');
    });

    it('should update updatedAt timestamp on revocation', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      service.confirmPairing(deviceId, pairingCode);
      const device = service.findById(deviceId);
      const originalUpdatedAt = device?.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      const revokedDevice = service.revokeDevice(deviceId);

      expect(revokedDevice.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt!.getTime()
      );

      jest.useRealTimers();
    });
  });

  describe('updatePresence', () => {
    it('should update device lastSeen timestamp', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      service.confirmPairing(deviceId, pairingCode);
      const device = service.findById(deviceId);
      const originalLastSeen = device?.lastSeen;

      jest.useFakeTimers();
      jest.advanceTimersByTime(5000);

      const updatedDevice = service.updatePresence(deviceId);

      expect(updatedDevice.lastSeen.getTime()).toBeGreaterThan(
        originalLastSeen!.getTime()
      );

      jest.useRealTimers();
    });

    it('should throw error for non-existent device', () => {
      expect(() => {
        service.updatePresence('fake-device-id');
      }).toThrow('Device not found');
    });
  });

  describe('isDeviceOnline', () => {
    it('should return true for recently active device', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      service.confirmPairing(deviceId, pairingCode);
      const isOnline = service.isDeviceOnline(deviceId);

      expect(isOnline).toBe(true);
    });

    it('should return false for device inactive over 60s', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      service.confirmPairing(deviceId, pairingCode);

      jest.useFakeTimers();
      jest.advanceTimersByTime(61 * 1000);

      const isOnline = service.isDeviceOnline(deviceId);

      expect(isOnline).toBe(false);

      jest.useRealTimers();
    });

    it('should return false for non-existent device', () => {
      const isOnline = service.isDeviceOnline('fake-device-id');
      expect(isOnline).toBe(false);
    });

    it('should return false for revoked device even if recently active', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      service.confirmPairing(deviceId, pairingCode);
      service.revokeDevice(deviceId);

      const isOnline = service.isDeviceOnline(deviceId);

      expect(isOnline).toBe(false);
    });
  });

  describe('canDeviceExecuteTasks', () => {
    it('should return true for trusted device', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      service.confirmPairing(deviceId, pairingCode);
      const canExecute = service.canDeviceExecuteTasks(deviceId);

      expect(canExecute).toBe(true);
    });

    it('should return false for revoked device', () => {
      const { deviceId, pairingCode } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      service.confirmPairing(deviceId, pairingCode);
      service.revokeDevice(deviceId);

      const canExecute = service.canDeviceExecuteTasks(deviceId);

      expect(canExecute).toBe(false);
    });

    it('should return false for pending device', () => {
      const { deviceId } = service.startPairing(mockUserId, {
        deviceName: mockDeviceName,
        platform: mockPlatform,
        publicKey: mockPublicKey,
        capabilities: mockCapabilities,
      });

      const canExecute = service.canDeviceExecuteTasks(deviceId);

      expect(canExecute).toBe(false);
    });

    it('should return false for non-existent device', () => {
      const canExecute = service.canDeviceExecuteTasks('fake-device-id');
      expect(canExecute).toBe(false);
    });
  });
});
