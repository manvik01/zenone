import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from './session.service';
import { IdentityService } from './identity.service';
import { AccountStatus } from '../common/dto/user.dto';

describe('SessionService', () => {
  let service: SessionService;
  let jwtService: JwtService;
  let identityService: IdentityService;

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: IdentityService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    jwtService = module.get<JwtService>(JwtService);
    identityService = module.get<IdentityService>(IdentityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session with access and refresh tokens', async () => {
      const accessToken = 'access-token-123';
      const refreshToken = 'refresh-token-456';

      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);

      const result = await service.createSession(mockUser.userId, mockUser.email);

      expect(result).toHaveProperty('accessToken', accessToken);
      expect(result).toHaveProperty('refreshToken', refreshToken);
      expect(result).toHaveProperty('userId', mockUser.userId);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(result).toHaveProperty('expiresIn');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should store session in memory', async () => {
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token-1')
        .mockReturnValueOnce('refresh-token-1');

      await service.createSession(mockUser.userId, mockUser.email);

      const sessions = await service.getUserSessions(mockUser.userId);
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should support multiple concurrent sessions for same user', async () => {
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token-1')
        .mockReturnValueOnce('refresh-token-1')
        .mockReturnValueOnce('access-token-2')
        .mockReturnValueOnce('refresh-token-2');

      await service.createSession(mockUser.userId, mockUser.email, 'device-1');
      await service.createSession(mockUser.userId, mockUser.email, 'device-2');

      const sessions = await service.getUserSessions(mockUser.userId);
      expect(sessions.length).toBe(2);
    });
  });

  describe('validateAccessToken', () => {
    it('should validate a valid access token', async () => {
      const payload = { sub: mockUser.userId, email: mockUser.email, type: 'access', sessionId: 'session-1' };
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('valid-token')
        .mockReturnValueOnce('refresh-token');
      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
      jest.spyOn(identityService, 'findById').mockResolvedValue(mockUser);

      await service.createSession(mockUser.userId, mockUser.email);

      const result = await service.validateAccessToken('valid-token');

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should reject invalid token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.validateAccessToken('invalid-token');

      expect(result).toBe(false);
    });

    it('should reject token for non-existent user', async () => {
      const payload = { sub: 'non-existent', email: 'test@example.com', type: 'access' };
      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
      jest.spyOn(identityService, 'findById').mockResolvedValue(null);

      const result = await service.validateAccessToken('valid-token');

      expect(result).toBe(false);
    });

    it('should reject expired session', async () => {
      const payload = { sub: mockUser.userId, email: mockUser.email, type: 'access', sessionId: 'session-1' };
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
      jest.spyOn(identityService, 'findById').mockResolvedValue(mockUser);

      const session = await service.createSession(mockUser.userId, mockUser.email);
      
      await service.revokeSession(session.accessToken);

      const result = await service.validateAccessToken(session.accessToken);
      expect(result).toBe(false);
    });
  });

  describe('refreshSession', () => {
    it('should refresh session with valid refresh token', async () => {
      const refreshPayload = { sub: mockUser.userId, email: mockUser.email, type: 'refresh' };
      jest.spyOn(jwtService, 'verify').mockReturnValue(refreshPayload);
      jest.spyOn(identityService, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshSession('valid-refresh-token');

      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
      expect(result).toHaveProperty('userId', mockUser.userId);
    });

    it('should reject invalid refresh token', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshSession('invalid-token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should reject wrong token type', async () => {
      const accessPayload = { sub: mockUser.userId, email: mockUser.email, type: 'access' };
      jest.spyOn(jwtService, 'verify').mockReturnValue(accessPayload);

      await expect(service.refreshSession('access-token'))
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session by access token', async () => {
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');
      const session = await service.createSession(mockUser.userId, mockUser.email);

      await service.revokeSession(session.accessToken);

      const isValid = await service.validateAccessToken(session.accessToken);
      expect(isValid).toBe(false);
    });

    it('should revoke all sessions for a user', async () => {
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');
      await service.createSession(mockUser.userId, mockUser.email, 'device-1');
      await service.createSession(mockUser.userId, mockUser.email, 'device-2');

      await service.revokeAllUserSessions(mockUser.userId);

      const sessions = await service.getUserSessions(mockUser.userId);
      expect(sessions.length).toBe(0);
    });
  });

  describe('session expiry', () => {
    it('should set access token expiry to 15 minutes', async () => {
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.createSession(mockUser.userId, mockUser.email);

      expect(result.expiresIn).toBe(900);
    });

    it('should clean up expired sessions', async () => {
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      
      const session = await service.createSession(mockUser.userId, mockUser.email);
      
      const futureTime = new Date(Date.now() + 20 * 60 * 1000);
      jest.useFakeTimers();
      jest.setSystemTime(futureTime);

      await service.cleanupExpiredSessions();

      const sessions = await service.getUserSessions(mockUser.userId);
      expect(sessions.length).toBe(0);

      jest.useRealTimers();
    });
  });
});
