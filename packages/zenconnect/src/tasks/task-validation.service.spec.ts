import { Test, TestingModule } from '@nestjs/testing';
import { TaskValidationService } from './task-validation.service';
import { DevicesService } from '../devices/devices.service';
import { Platform, TrustStatus } from '../common/dto/device.dto';
import { BadRequestException } from '@nestjs/common';

describe('TaskValidationService', () => {
  let service: TaskValidationService;
  let devicesService: DevicesService;

  const mockUserId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskValidationService, DevicesService],
    }).compile();

    service = module.get<TaskValidationService>(TaskValidationService);
    devicesService = module.get<DevicesService>(DevicesService);
  });

  describe('validateTaskCreation', () => {
    it('should allow task creation with trusted device', () => {
      const { deviceId, pairingCode } = devicesService.startPairing(mockUserId, {
        deviceName: 'Test Device',
        platform: Platform.ANDROID,
        publicKey: 'key',
        capabilities: ['execute_tasks'],
      });

      devicesService.confirmPairing(deviceId, pairingCode);

      expect(() => {
        service.validateTaskCreation(deviceId, mockUserId);
      }).not.toThrow();
    });

    it('should reject task creation with revoked device', () => {
      const { deviceId, pairingCode } = devicesService.startPairing(mockUserId, {
        deviceName: 'Test Device',
        platform: Platform.ANDROID,
        publicKey: 'key',
        capabilities: ['execute_tasks'],
      });

      devicesService.confirmPairing(deviceId, pairingCode);
      devicesService.revokeDevice(deviceId);

      expect(() => {
        service.validateTaskCreation(deviceId, mockUserId);
      }).toThrow(BadRequestException);

      try {
        service.validateTaskCreation(deviceId, mockUserId);
      } catch (error) {
        expect((error as BadRequestException).message).toContain('revoked');
        expect((error as BadRequestException).message).toContain('cannot execute tasks');
      }
    });

    it('should reject task creation with pending device', () => {
      const { deviceId } = devicesService.startPairing(mockUserId, {
        deviceName: 'Test Device',
        platform: Platform.ANDROID,
        publicKey: 'key',
        capabilities: ['execute_tasks'],
      });

      expect(() => {
        service.validateTaskCreation(deviceId, mockUserId);
      }).toThrow(BadRequestException);

      try {
        service.validateTaskCreation(deviceId, mockUserId);
      } catch (error) {
        expect((error as BadRequestException).message).toContain('not trusted');
      }
    });

    it('should reject task creation with non-existent device', () => {
      expect(() => {
        service.validateTaskCreation('fake-device-id', mockUserId);
      }).toThrow(BadRequestException);

      try {
        service.validateTaskCreation('fake-device-id', mockUserId);
      } catch (error) {
        expect((error as BadRequestException).message).toContain('not found');
      }
    });

    it('should reject task creation when device belongs to different user', () => {
      const { deviceId, pairingCode } = devicesService.startPairing(mockUserId, {
        deviceName: 'Test Device',
        platform: Platform.ANDROID,
        publicKey: 'key',
        capabilities: ['execute_tasks'],
      });

      devicesService.confirmPairing(deviceId, pairingCode);

      expect(() => {
        service.validateTaskCreation(deviceId, 'other-user-id');
      }).toThrow(BadRequestException);

      try {
        service.validateTaskCreation(deviceId, 'other-user-id');
      } catch (error) {
        expect((error as BadRequestException).message).toContain('not authorized');
      }
    });
  });

  describe('validateExecutorDevice', () => {
    it('should validate trusted executor device', () => {
      const { deviceId, pairingCode } = devicesService.startPairing(mockUserId, {
        deviceName: 'Executor',
        platform: Platform.WINDOWS,
        publicKey: 'key',
        capabilities: ['execute_tasks'],
      });

      devicesService.confirmPairing(deviceId, pairingCode);

      const result = service.validateExecutorDevice(deviceId);

      expect(result).toBe(true);
    });

    it('should reject revoked executor device', () => {
      const { deviceId, pairingCode } = devicesService.startPairing(mockUserId, {
        deviceName: 'Executor',
        platform: Platform.WINDOWS,
        publicKey: 'key',
        capabilities: ['execute_tasks'],
      });

      devicesService.confirmPairing(deviceId, pairingCode);
      devicesService.revokeDevice(deviceId);

      const result = service.validateExecutorDevice(deviceId);

      expect(result).toBe(false);
    });

    it('should reject pending executor device', () => {
      const { deviceId } = devicesService.startPairing(mockUserId, {
        deviceName: 'Executor',
        platform: Platform.WINDOWS,
        publicKey: 'key',
        capabilities: ['execute_tasks'],
      });

      const result = service.validateExecutorDevice(deviceId);

      expect(result).toBe(false);
    });

    it('should reject non-existent executor device', () => {
      const result = service.validateExecutorDevice('fake-device-id');

      expect(result).toBe(false);
    });
  });
});
