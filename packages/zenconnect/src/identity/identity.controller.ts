import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { IdentityService } from './identity.service';
import { SessionService } from './session.service';
import { VerificationService } from './verification.service';
import { CreateUserDto, UserResponseDto } from '../common/dto/user.dto';
import {
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from '../common/dto/session.dto';
import { JwtAuthGuard, RequestWithUser } from './jwt-auth.guard';

@Controller('v1/auth')
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly sessionService: SessionService,
    private readonly verificationService: VerificationService,
  ) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.identityService.register(createUserDto);
      const verificationToken = await this.verificationService.createEmailVerificationToken(
        user.userId,
      );

      const response: UserResponseDto & { verificationToken: string } = {
        userId: user.userId,
        email: user.email,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
        emailVerified: user.emailVerified,
        verificationToken,
      };

      return response;
    } catch (error: any) {
      if (error.message === 'Email already registered') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    try {
      await this.verificationService.verifyEmailWithToken(verifyEmailDto.token);
      return {
        message: 'Email verified successfully',
        emailVerified: true,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const user = await this.identityService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.sessionService.createSession(user.userId, user.email);

    return session;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    try {
      const session = await this.sessionService.refreshSession(
        refreshTokenDto.refreshToken,
      );
      return session;
    } catch (error: any) {
      throw new UnauthorizedException(error.message);
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: RequestWithUser) {
    const accessToken = req['accessToken'];
    await this.sessionService.revokeSession(accessToken);
    return {
      message: 'Logged out successfully',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Request() req: RequestWithUser) {
    const user = await this.identityService.findById(req.user!.userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      userId: user.userId,
      email: user.email,
      accountStatus: user.accountStatus,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    const resetToken = await this.verificationService.createPasswordResetToken(
      dto.email,
    );

    return {
      message: 'If the email exists, a password reset link has been sent',
      resetToken,
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      await this.verificationService.resetPasswordWithToken(
        dto.token,
        dto.newPassword,
      );

      return {
        message: 'Password reset successfully',
      };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }
}
