import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import {
  PairDeviceStartDto,
  PairDeviceConfirmDto,
  DeviceResponseDto,
} from '../common/dto/device.dto';
import { JwtAuthGuard, RequestWithUser } from '../identity/jwt-auth.guard';

@Controller('v1/devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('pair/start')
  startPairing(
    @Request() req: RequestWithUser,
    @Body() pairDto: PairDeviceStartDto,
  ) {
    return this.devicesService.startPairing(req.user!.userId, pairDto);
  }

  @Post('pair/confirm/:deviceId')
  confirmPairing(
    @Request() req: RequestWithUser,
    @Param('deviceId') deviceId: string,
    @Body() confirmDto: PairDeviceConfirmDto,
  ) {
    const device = this.devicesService.findById(deviceId);
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.userId !== req.user!.userId) {
      throw new ForbiddenException('Not authorized to confirm this device');
    }

    return this.devicesService.confirmPairing(deviceId, confirmDto.pairingCode);
  }

  @Get()
  listDevices(@Request() req: RequestWithUser): DeviceResponseDto[] {
    const devices = this.devicesService.findByUserId(req.user!.userId);
    return devices.map((device) => ({
      deviceId: device.deviceId,
      platform: device.platform,
      deviceName: device.deviceName,
      capabilities: device.capabilities,
      lastSeen: device.lastSeen,
      trustStatus: device.trustStatus,
      isOnline: this.devicesService.isDeviceOnline(device.deviceId),
      revokedAt: device.revokedAt,
      createdAt: device.createdAt,
    }));
  }

  @Get(':deviceId')
  getDevice(
    @Request() req: RequestWithUser,
    @Param('deviceId') deviceId: string,
  ): DeviceResponseDto {
    const device = this.devicesService.findById(deviceId);
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.userId !== req.user!.userId) {
      throw new ForbiddenException('Not authorized to access this device');
    }

    return {
      deviceId: device.deviceId,
      platform: device.platform,
      deviceName: device.deviceName,
      capabilities: device.capabilities,
      lastSeen: device.lastSeen,
      trustStatus: device.trustStatus,
      isOnline: this.devicesService.isDeviceOnline(device.deviceId),
      revokedAt: device.revokedAt,
      createdAt: device.createdAt,
    };
  }

  @Post(':deviceId/heartbeat')
  updatePresence(
    @Request() req: RequestWithUser,
    @Param('deviceId') deviceId: string,
  ) {
    const device = this.devicesService.findById(deviceId);
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.userId !== req.user!.userId) {
      throw new ForbiddenException('Not authorized to update this device');
    }

    const updatedDevice = this.devicesService.updatePresence(deviceId);

    return {
      deviceId: updatedDevice.deviceId,
      lastSeen: updatedDevice.lastSeen,
      isOnline: this.devicesService.isDeviceOnline(deviceId),
    };
  }

  @Delete(':deviceId')
  revokeDevice(
    @Request() req: RequestWithUser,
    @Param('deviceId') deviceId: string,
  ) {
    const device = this.devicesService.findById(deviceId);
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.userId !== req.user!.userId) {
      throw new ForbiddenException('Not authorized to revoke this device');
    }

    return this.devicesService.revokeDevice(deviceId);
  }
}
