import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { SessionService } from './session.service';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'zenone-dev-secret-change-in-production',
      signOptions: { algorithm: 'HS256' },
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
