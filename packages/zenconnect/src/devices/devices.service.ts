import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Device, TrustStatus, PairDeviceStartDto } from '../common/dto/device.dto';

@Injectable()
export class DevicesService {
  private devices: Map<string, Device> = new Map();
  private pairingChallenges: Map<string, { deviceId: string; code: string; expiresAt: Date }> = new Map();

  startPairing(userId: string, pairDto: PairDeviceStartDto): { deviceId: string; pairingCode: string; expiresAt: Date } {
    const deviceId = uuidv4();
    const pairingCode = this.generatePairingCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const device: Device = {
      deviceId,
      userId,
      platform: pairDto.platform,
      deviceName: pairDto.deviceName,
      publicKey: pairDto.publicKey,
      capabilities: pairDto.capabilities,
      lastSeen: new Date(),
      trustStatus: TrustStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.devices.set(deviceId, device);
    this.pairingChallenges.set(deviceId, { deviceId, code: pairingCode, expiresAt });

    return { deviceId, pairingCode, expiresAt };
  }

  confirmPairing(deviceId: string, pairingCode: string): Device {
    const challenge = this.pairingChallenges.get(deviceId);
    if (!challenge) {
      throw new Error('No pairing challenge found');
    }

    if (challenge.expiresAt < new Date()) {
      this.pairingChallenges.delete(deviceId);
      throw new Error('Pairing code expired');
    }

    if (challenge.code !== pairingCode) {
      throw new Error('Invalid pairing code');
    }

    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    device.trustStatus = TrustStatus.TRUSTED;
    device.updatedAt = new Date();
    this.devices.set(deviceId, device);
    this.pairingChallenges.delete(deviceId);

    return device;
  }

  findByUserId(userId: string): Device[] {
    return Array.from(this.devices.values()).filter(
      (device) => device.userId === userId,
    );
  }

  findById(deviceId: string): Device | null {
    return this.devices.get(deviceId) || null;
  }

  revokeDevice(deviceId: string): Device {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    device.trustStatus = TrustStatus.REVOKED;
    device.updatedAt = new Date();
    this.devices.set(deviceId, device);

    return device;
  }

  private generatePairingCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
