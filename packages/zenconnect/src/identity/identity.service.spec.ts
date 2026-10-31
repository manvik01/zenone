import { Test, TestingModule } from '@nestjs/testing';
import { IdentityService } from './identity.service';
import { AccountStatus } from '../common/dto/user.dto';

describe('IdentityService', () => {
  let service: IdentityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IdentityService],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create a new user with hashed password', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
      };

      const user = await service.register(createUserDto);

      expect(user).toHaveProperty('userId');
      expect(user.email).toBe(createUserDto.email);
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe(createUserDto.password);
      expect(user.accountStatus).toBe(AccountStatus.ACTIVE);
      expect(user.emailVerified).toBe(false);
    });

    it('should reject duplicate email registration', async () => {
      const createUserDto = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
      };

      await service.register(createUserDto);

      await expect(service.register(createUserDto))
        .rejects.toThrow('Email already registered');
    });

    it('should hash password with bcrypt', async () => {
      const createUserDto = {
        email: 'test2@example.com',
        password: 'MyPassword123',
      };

      const user = await service.register(createUserDto);

      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(user.passwordHash.length).toBeGreaterThan(50);
    });
  });

  describe('validateUser', () => {
    beforeEach(async () => {
      await service.register({
        email: 'valid@example.com',
        password: 'CorrectPassword123',
      });
    });

    it('should validate correct credentials', async () => {
      const user = await service.validateUser('valid@example.com', 'CorrectPassword123');

      expect(user).not.toBeNull();
      expect(user?.email).toBe('valid@example.com');
    });

    it('should reject incorrect password', async () => {
      const user = await service.validateUser('valid@example.com', 'WrongPassword');

      expect(user).toBeNull();
    });

    it('should reject non-existent email', async () => {
      const user = await service.validateUser('nonexistent@example.com', 'AnyPassword');

      expect(user).toBeNull();
    });

    it('should be case-sensitive for email', async () => {
      const user = await service.validateUser('VALID@EXAMPLE.COM', 'CorrectPassword123');

      expect(user).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const created = await service.register({
        email: 'findme@example.com',
        password: 'Password123',
      });

      const found = await service.findById(created.userId);

      expect(found).not.toBeNull();
      expect(found?.userId).toBe(created.userId);
      expect(found?.email).toBe(created.email);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      await service.register({
        email: 'findbyme@example.com',
        password: 'Password123',
      });

      const found = await service.findByEmail('findbyme@example.com');

      expect(found).not.toBeNull();
      expect(found?.email).toBe('findbyme@example.com');
    });

    it('should return null for non-existent email', async () => {
      const found = await service.findByEmail('nonexistent@example.com');

      expect(found).toBeNull();
    });
  });

  describe('verifyEmail', () => {
    it('should mark user email as verified', async () => {
      const user = await service.register({
        email: 'verify@example.com',
        password: 'Password123',
      });

      expect(user.emailVerified).toBe(false);

      await service.verifyEmail(user.userId);

      const verified = await service.findById(user.userId);
      expect(verified?.emailVerified).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(service.verifyEmail('non-existent-id'))
        .rejects.toThrow('User not found');
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      const user = await service.register({
        email: 'changepass@example.com',
        password: 'OldPassword123',
      });

      await service.updatePassword(user.userId, 'NewPassword456');

      const validWithOld = await service.validateUser('changepass@example.com', 'OldPassword123');
      expect(validWithOld).toBeNull();

      const validWithNew = await service.validateUser('changepass@example.com', 'NewPassword456');
      expect(validWithNew).not.toBeNull();
    });

    it('should hash new password', async () => {
      const user = await service.register({
        email: 'changepass2@example.com',
        password: 'OldPassword123',
      });

      await service.updatePassword(user.userId, 'NewPassword456');

      const updated = await service.findById(user.userId);
      expect(updated?.passwordHash).not.toBe('NewPassword456');
      expect(updated?.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('should throw error for non-existent user', async () => {
      await expect(service.updatePassword('non-existent-id', 'NewPassword'))
        .rejects.toThrow('User not found');
    });
  });
});
