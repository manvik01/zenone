import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { IdentityModule } from './identity/identity.module';
import { DevicesModule } from './devices/devices.module';
import { TasksModule } from './tasks/tasks.module';
import { IntentModule } from './intent/intent.module';
import { TransfersModule } from './transfers/transfers.module';
import { ZenControlModule } from './zencontrol/zencontrol.module';

@Module({
  imports: [
    GatewayModule,
    IdentityModule,
    DevicesModule,
    TasksModule,
    IntentModule,
    TransfersModule,
    ZenControlModule,
  ],
})
export class AppModule {}
