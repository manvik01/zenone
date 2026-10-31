import { Test, TestingModule } from '@nestjs/testing';
import { VerificationService } from './verification.service';
import { IdentityService } from './identity.service';

describe('VerificationService', () => {
  let service: VerificationService;
  let identityService: IdentityService;

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    accountStatus: 'ACTIVE' as any,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: IdentityService,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            verifyEmail: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
    identityService = module.get<IdentityService>(IdentityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmailVerificationToken', () => {
    it('should create a verification token for user', async () => {
      const token = await service.createEmailVerificationToken(mockUser.userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^ev_/);
      expect(token.length).toBeGreaterThan(10);
    });

    it('should create unique tokens', async () => {
      const token1 = await service.createEmailVerificationToken(mockUser.userId);
      const token2 = await service.createEmailVerificationToken(mockUser.userId);

      expect(token1).not.toBe(token2);
    });

    it('should store token with expiry', async () => {
      const token = await service.createEmailVerificationToken(mockUser.userId);

      const isValid = await service.validateEmailVerificationToken(token);
      expect(isValid).not.toBeNull();
    });
  });

  describe('validateEmailVerificationToken', () => {
    it('should validate a valid token', async () => {
      const token = await service.createEmailVerificationToken(mockUser.userId);

      const result = await service.validateEmailVerificationToken(token);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(mockUser.userId);
    });

    it('should reject invalid token', async () => {
      const result = await service.validateEmailVerificationToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should reject expired token', async () => {
      const token = await service.createEmailVerificationToken(mockUser.userId);

      const futureTime = new Date(Date.now() + 25 * 60 * 60 * 1000);
      jest.useFakeTimers();
      jest.setSystemTime(futureTime);

      const result = await service.validateEmailVerificationToken(token);
      expect(result).toBeNull();

      jest.useRealTimers();
    });

    it('should reject already used token', async () => {
      const token = await service.createEmailVerificationToken(mockUser.userId);
      jest.spyOn(identityService, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(identityService, 'verifyEmail').mockResolvedValue(undefined);

      await service.verifyEmailWithToken(token);

      const result = await service.validateEmailVerificationToken(token);
      expect(result).toBeNull();
    });
  });

  describe('verifyEmailWithToken', () => {
    it('should verify email with valid token', async () => {
      const token = await service.createEmailVerificationToken(mockUser.userId);
      jest.spyOn(identityService, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(identityService, 'verifyEmail').mockResolvedValue(undefined);

      await service.verifyEmailWithToken(token);

      expect(identityService.verifyEmail).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should throw error for invalid token', async () => {
      await expect(service.verifyEmailWithToken('invalid-token'))
        .rejects.toThrow('Invalid or expired verification token');
    });

    it('should throw error for already verified email', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      const token = await service.createEmailVerificationToken(mockUser.userId);
      jest.spyOn(identityService, 'findById').mockResolvedValue(verifiedUser);

      await expect(service.verifyEmailWithToken(token))
        .rejects.toThrow('Email already verified');
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create a password reset token', async () => {
      jest.spyOn(identityService, 'findByEmail').mockResolvedValue(mockUser);

      const token = await service.createPasswordResetToken(mockUser.email);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should not throw error for non-existent email (security)', async () => {
      jest.spyOn(identityService, 'findByEmail').mockResolvedValue(null);

      await expect(service.createPasswordResetToken('nonexistent@example.com'))
        .resolves.not.toThrow();
    });

    it('should return a token even for non-existent email (security)', async () => {
      jest.spyOn(identityService, 'findByEmail').mockResolvedValue(null);

      const token = await service.createPasswordResetToken('nonexistent@example.com');

      expect(token).toBeDefined();
    });
  });

  describe('resetPasswordWithToken', () => {
    it('should reset password with valid token', async () => {
      jest.spyOn(identityService, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(identityService, 'updatePassword').mockResolvedValue(undefined);

      const token = await service.createPasswordResetToken(mockUser.email);

      await service.resetPasswordWithToken(token, 'NewPassword123');

      expect(identityService.updatePassword).toHaveBeenCalledWith(
        mockUser.userId,
        'NewPassword123'
      );
    });

    it('should throw error for invalid token', async () => {
      await expect(service.resetPasswordWithToken('invalid-token', 'NewPassword'))
        .rejects.toThrow('Invalid or expired password reset token');
    });

    it('should throw error for expired token', async () => {
      jest.spyOn(identityService, 'findByEmail').mockResolvedValue(mockUser);
      const token = await service.createPasswordResetToken(mockUser.email);

      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      jest.useFakeTimers();
      jest.setSystemTime(futureTime);

      await expect(service.resetPasswordWithToken(token, 'NewPassword'))
        .rejects.toThrow('Invalid or expired password reset token');

      jest.useRealTimers();
    });

    it('should mark token as used after reset', async () => {
      jest.spyOn(identityService, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(identityService, 'updatePassword').mockResolvedValue(undefined);

      const token = await service.createPasswordResetToken(mockUser.email);

      await service.resetPasswordWithToken(token, 'NewPassword123');

      await expect(service.resetPasswordWithToken(token, 'AnotherPassword'))
        .rejects.toThrow('Invalid or expired password reset token');
    });
  });

  describe('token expiry', () => {
    it('should set email verification token expiry to 24 hours', async () => {
      const token = await service.createEmailVerificationToken(mockUser.userId);

      jest.useFakeTimers();
      
      jest.setSystemTime(new Date(Date.now() + 23 * 60 * 60 * 1000));
      let result = await service.validateEmailVerificationToken(token);
      expect(result).not.toBeNull();

      jest.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000));
      result = await service.validateEmailVerificationToken(token);
      expect(result).toBeNull();

      jest.useRealTimers();
    });

    it('should set password reset token expiry to 1 hour', async () => {
      jest.spyOn(identityService, 'findByEmail').mockResolvedValue(mockUser);
      jest.spyOn(identityService, 'updatePassword').mockResolvedValue(undefined);

      const token = await service.createPasswordResetToken(mockUser.email);

      jest.useFakeTimers();
      jest.setSystemTime(new Date(Date.now() + 55 * 60 * 1000));
      
      await expect(service.resetPasswordWithToken(token, 'NewPass123'))
        .resolves.not.toThrow();

      jest.useRealTimers();
    });
  });
});
