import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class SessionResponseDto {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  expiresIn: number;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class VerifyEmailDto {
  @IsString()
  token: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export interface Session {
  sessionId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  createdAt: Date;
  expiresAt: Date;
  refreshExpiresAt: Date;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface VerificationToken {
  token: string;
  userId: string;
  type: 'email_verification' | 'password_reset';
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}
