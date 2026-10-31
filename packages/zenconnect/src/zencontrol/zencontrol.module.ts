import { Module } from '@nestjs/common';
import { ZenControlController } from './zencontrol.controller';
import { GrantsService } from './grants.service';
import { AuditService } from './audit.service';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  controllers: [ZenControlController],
  providers: [GrantsService, AuditService],
  exports: [GrantsService, AuditService],
})
export class ZenControlModule {}
