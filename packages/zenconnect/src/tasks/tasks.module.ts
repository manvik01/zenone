import { Module, forwardRef } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskValidationService } from './task-validation.service';
import { DevicesModule } from '../devices/devices.module';
import { IdentityModule } from '../identity/identity.module';
import { TransfersModule } from '../transfers/transfers.module';
import { ZenControlModule } from '../zencontrol/zencontrol.module';

@Module({
  imports: [DevicesModule, IdentityModule, ZenControlModule, forwardRef(() => TransfersModule)],
  controllers: [TasksController],
  providers: [TasksService, TaskValidationService],
  exports: [TasksService, TaskValidationService],
})
export class TasksModule {}
