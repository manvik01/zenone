import { Controller, Post, Get, Delete, Body, Param, Headers } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PairDeviceStartDto, PairDeviceConfirmDto, DeviceResponseDto } from '../common/dto/device.dto';

@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('pair/start')
  pairStart(
    @Body() pairDto: PairDeviceStartDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.devicesService.startPairing(userId, pairDto);
  }

  @Post('pair/confirm')
  pairConfirm(
    @Body() confirmDto: PairDeviceConfirmDto & { deviceId: string },
  ): DeviceResponseDto {
    const device = this.devicesService.confirmPairing(
      confirmDto.deviceId,
      confirmDto.pairingCode,
    );

    return {
      deviceId: device.deviceId,
      platform: device.platform,
      deviceName: device.deviceName,
      capabilities: device.capabilities,
      lastSeen: device.lastSeen,
      trustStatus: device.trustStatus,
      createdAt: device.createdAt,
    };
  }

  @Get()
  listDevices(@Headers('x-user-id') userId: string): DeviceResponseDto[] {
    const devices = this.devicesService.findByUserId(userId);
    return devices.map((device) => ({
      deviceId: device.deviceId,
      platform: device.platform,
      deviceName: device.deviceName,
      capabilities: device.capabilities,
      lastSeen: device.lastSeen,
      trustStatus: device.trustStatus,
      createdAt: device.createdAt,
    }));
  }

  @Delete(':deviceId')
  revokeDevice(@Param('deviceId') deviceId: string): DeviceResponseDto {
    const device = this.devicesService.revokeDevice(deviceId);
    return {
      deviceId: device.deviceId,
      platform: device.platform,
      deviceName: device.deviceName,
      capabilities: device.capabilities,
      lastSeen: device.lastSeen,
      trustStatus: device.trustStatus,
      createdAt: device.createdAt,
    };
  }
}
