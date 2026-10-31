import { Controller, Get } from '@nestjs/common';

@Controller()
export class GatewayController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'zenconnect',
      version: '0.0.2',
    };
  }

  @Get()
  root() {
    return {
      service: 'ZenConnect',
      version: '0.0.2',
      description: 'ZenConnect cloud orchestration layer - prototype',
      endpoints: {
        health: '/health',
        identity: '/v1/auth',
        devices: '/v1/devices',
        tasks: '/v1/tasks',
        transfers: '/v1/transfers',
      },
    };
  }
}
