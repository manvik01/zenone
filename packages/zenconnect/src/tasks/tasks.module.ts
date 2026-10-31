import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskValidationService } from './task-validation.service';
import { DevicesModule } from '../devices/devices.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [DevicesModule, IdentityModule],
  controllers: [TasksController],
  providers: [TasksService, TaskValidationService],
  exports: [TasksService, TaskValidationService],
})
export class TasksModule {}
