import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { VerificationToken } from '../common/dto/session.dto';
import { IdentityService } from './identity.service';

@Injectable()
export class VerificationService {
  private tokens: Map<string, VerificationToken> = new Map();
  private readonly EMAIL_VERIFICATION_EXPIRY = 24 * 60 * 60 * 1000;
  private readonly PASSWORD_RESET_EXPIRY = 60 * 60 * 1000;

  constructor(private identityService: IdentityService) {}

  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = `ev_${uuidv4()}`;
    const now = new Date();

    const verificationToken: VerificationToken = {
      token,
      userId,
      type: 'email_verification',
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.EMAIL_VERIFICATION_EXPIRY),
      used: false,
    };

    this.tokens.set(token, verificationToken);
    return token;
  }

  async validateEmailVerificationToken(
    token: string,
  ): Promise<VerificationToken | null> {
    const verificationToken = this.tokens.get(token);

    if (!verificationToken) {
      return null;
    }

    if (verificationToken.type !== 'email_verification') {
      return null;
    }

    if (verificationToken.used) {
      return null;
    }

    if (new Date() > verificationToken.expiresAt) {
      return null;
    }

    return verificationToken;
  }

  async verifyEmailWithToken(token: string): Promise<void> {
    const verificationToken = await this.validateEmailVerificationToken(token);

    if (!verificationToken) {
      throw new Error('Invalid or expired verification token');
    }

    const user = await this.identityService.findById(verificationToken.userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.emailVerified) {
      throw new Error('Email already verified');
    }

    await this.identityService.verifyEmail(verificationToken.userId);

    verificationToken.used = true;
    this.tokens.set(token, verificationToken);
  }

  async createPasswordResetToken(email: string): Promise<string> {
    const token = `pr_${uuidv4()}`;
    const now = new Date();

    const user = await this.identityService.findByEmail(email);

    if (!user) {
      return token;
    }

    const resetToken: VerificationToken = {
      token,
      userId: user.userId,
      type: 'password_reset',
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.PASSWORD_RESET_EXPIRY),
      used: false,
    };

    this.tokens.set(token, resetToken);
    return token;
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    const resetToken = this.tokens.get(token);

    if (!resetToken) {
      throw new Error('Invalid or expired password reset token');
    }

    if (resetToken.type !== 'password_reset') {
      throw new Error('Invalid or expired password reset token');
    }

    if (resetToken.used) {
      throw new Error('Invalid or expired password reset token');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new Error('Invalid or expired password reset token');
    }

    await this.identityService.updatePassword(resetToken.userId, newPassword);

    resetToken.used = true;
    this.tokens.set(token, resetToken);
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [token, verificationToken] of this.tokens.entries()) {
      if (now > verificationToken.expiresAt || verificationToken.used) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      this.tokens.delete(token);
    }
  }
}
