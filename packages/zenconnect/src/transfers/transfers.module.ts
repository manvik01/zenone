import { Module, forwardRef } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { TransferExecutionService } from './transfer-execution.service';
import { TasksModule } from '../tasks/tasks.module';
import { ZenControlModule } from '../zencontrol/zencontrol.module';

@Module({
  imports: [forwardRef(() => TasksModule), ZenControlModule],
  controllers: [TransfersController],
  providers: [TransfersService, TransferExecutionService],
  exports: [TransfersService, TransferExecutionService],
})
export class TransfersModule {}
