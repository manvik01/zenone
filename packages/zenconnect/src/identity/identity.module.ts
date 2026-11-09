import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret } from '../common/config';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { SessionService } from './session.service';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { algorithm: 'HS256' as const },
      }),
    }),
  ],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    SessionService,
    VerificationService,
    JwtAuthGuard,
  ],
  exports: [IdentityService, SessionService, JwtAuthGuard],
})
export class IdentityModule {}
