import { Injectable, BadRequestException } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';
import { TrustStatus } from '../common/dto/device.dto';

@Injectable()
export class TaskValidationService {
  constructor(private readonly devicesService: DevicesService) {}

  validateTaskCreation(deviceId: string, userId: string): void {
    const device = this.devicesService.findById(deviceId);

    if (!device) {
      throw new BadRequestException(
        `Device ${deviceId} not found. Cannot create task.`
      );
    }

    if (device.userId !== userId) {
      throw new BadRequestException(
        `Device ${deviceId} not authorized for this user. Cannot create task.`
      );
    }

    if (device.trustStatus === TrustStatus.REVOKED) {
      throw new BadRequestException(
        `Device ${deviceId} has been revoked and cannot execute tasks. Please use a different device.`
      );
    }

    if (device.trustStatus !== TrustStatus.TRUSTED) {
      throw new BadRequestException(
        `Device ${deviceId} is not trusted. Complete device pairing before creating tasks.`
      );
    }
  }

  validateExecutorDevice(deviceId: string): boolean {
    const device = this.devicesService.findById(deviceId);

    if (!device) {
      return false;
    }

    return device.trustStatus === TrustStatus.TRUSTED;
  }
}
