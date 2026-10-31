import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { SessionService } from './session.service';
import { VerificationService } from './verification.service';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus } from '../common/dto/user.dto';

describe('IdentityController (Integration)', () => {
  let app: INestApplication;
  let identityService: IdentityService;
  let sessionService: SessionService;
  let verificationService: VerificationService;

  beforeEach(async () => {
    let tokenCounter = 0;
    const tokenMap = new Map<string, any>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdentityController],
      providers: [
        IdentityService,
        SessionService,
        VerificationService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockImplementation((payload) => {
              tokenCounter++;
              const token = `mock-jwt-token-${tokenCounter}-${payload.type || 'access'}`;
              tokenMap.set(token, payload);
              return token;
            }),
            verify: jest.fn().mockImplementation((token) => {
              const payload = tokenMap.get(token);
              if (!payload) {
                throw new Error('Invalid token');
              }
              return payload;
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    identityService = module.get<IdentityService>(IdentityService);
    sessionService = module.get<SessionService>(SessionService);
    verificationService = module.get<VerificationService>(VerificationService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v1/auth/register', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty('email', 'newuser@example.com');
          expect(res.body).toHaveProperty('accountStatus', AccountStatus.ACTIVE);
          expect(res.body).toHaveProperty('emailVerified', false);
          expect(res.body).toHaveProperty('verificationToken');
          expect(res.body).not.toHaveProperty('passwordHash');
        });
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
        })
        .expect(400);
    });

    it('should reject short password', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
        })
        .expect(400);
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
        });

      return request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
        })
        .expect(409);
    });
  });

  describe('POST /v1/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          email: 'verify@example.com',
          password: 'SecurePass123!',
        });

      const verificationToken = registerRes.body.verificationToken;

      return request(app.getHttpServer())
        .post('/v1/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Email verified successfully');
          expect(res.body).toHaveProperty('emailVerified', true);
        });
    });

    it('should reject invalid verification token', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);
    });
  });

  describe('POST /v1/auth/login', () => {
    beforeEach(async () => {
      const user = await identityService.register({
        email: 'login@example.com',
        password: 'LoginPass123',
      });
      await identityService.verifyEmail(user.userId);
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'LoginPass123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('userId');
          expect(res.body).toHaveProperty('email', 'login@example.com');
          expect(res.body).toHaveProperty('expiresIn');
        });
    });

    it('should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword',
        })
        .expect(401);
    });

    it('should support multiple concurrent sessions', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'LoginPass123',
        });

      const res2 = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'LoginPass123',
        });

      expect(res1.body.accessToken).not.toBe(res2.body.accessToken);
      expect(res1.body.refreshToken).not.toBe(res2.body.refreshToken);
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('should refresh session with valid refresh token', async () => {
      const user = await identityService.register({
        email: 'refresh@example.com',
        password: 'RefreshPass123',
      });
      await identityService.verifyEmail(user.userId);

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'refresh@example.com',
          password: 'RefreshPass123',
        });

      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.accessToken).not.toBe(loginRes.body.accessToken);
        });
    });

    it('should reject invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should logout and revoke session', async () => {
      const user = await identityService.register({
        email: 'logout@example.com',
        password: 'LogoutPass123',
      });
      await identityService.verifyEmail(user.userId);

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'logout@example.com',
          password: 'LogoutPass123',
        });

      return request(app.getHttpServer())
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message', 'Logged out successfully');
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/logout')
        .expect(401);
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return current user info', async () => {
      const user = await identityService.register({
        email: 'me@example.com',
        password: 'MePass123',
      });
      await identityService.verifyEmail(user.userId);

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'me@example.com',
          password: 'MePass123',
        });

      return request(app.getHttpServer())
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('userId', user.userId);
          expect(res.body).toHaveProperty('email', 'me@example.com');
          expect(res.body).not.toHaveProperty('passwordHash');
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/v1/auth/me')
        .expect(401);
    });
  });

  describe('POST /v1/auth/request-password-reset', () => {
    it('should send password reset token', async () => {
      await identityService.register({
        email: 'reset@example.com',
        password: 'OldPass123',
      });

      return request(app.getHttpServer())
        .post('/v1/auth/request-password-reset')
        .send({ email: 'reset@example.com' })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('resetToken');
        });
    });

    it('should not reveal if email exists (security)', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/request-password-reset')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);
    });
  });

  describe('POST /v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      await identityService.register({
        email: 'resetpass@example.com',
        password: 'OldPass123',
      });

      const resetRes = await request(app.getHttpServer())
        .post('/v1/auth/request-password-reset')
        .send({ email: 'resetpass@example.com' });

      await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({
          token: resetRes.body.resetToken,
          newPassword: 'NewPass456',
        })
        .expect(200);

      return request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({
          email: 'resetpass@example.com',
          password: 'NewPass456',
        })
        .expect(200);
    });

    it('should reject invalid reset token', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPass456',
        })
        .expect(400);
    });
  });
});
