import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { IdentityModule } from './identity/identity.module';
import { DevicesModule } from './devices/devices.module';
import { TasksModule } from './tasks/tasks.module';
import { IntentModule } from './intent/intent.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    GatewayModule,
    IdentityModule,
    DevicesModule,
    TasksModule,
    IntentModule,
    TransfersModule,
  ],
})
export class AppModule {}
