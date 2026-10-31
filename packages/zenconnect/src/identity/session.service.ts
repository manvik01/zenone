import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { Session, SessionResponseDto } from '../common/dto/session.dto';
import { IdentityService } from './identity.service';

@Injectable()
export class SessionService {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private readonly ACCESS_TOKEN_EXPIRY = 15 * 60;
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60;

  constructor(
    private jwtService: JwtService,
    private identityService: IdentityService,
  ) {}

  async createSession(
    userId: string,
    email: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<SessionResponseDto> {
    const sessionId = uuidv4();
    const now = new Date();

    const accessTokenPayload = {
      sub: userId,
      email,
      type: 'access',
      sessionId,
    };

    const refreshTokenPayload = {
      sub: userId,
      email,
      type: 'refresh',
      sessionId,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });

    const session: Session = {
      sessionId,
      userId,
      accessToken,
      refreshToken,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ACCESS_TOKEN_EXPIRY * 1000),
      refreshExpiresAt: new Date(now.getTime() + this.REFRESH_TOKEN_EXPIRY * 1000),
      deviceInfo,
      ipAddress,
    };

    this.sessions.set(accessToken, session);

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(accessToken);

    return {
      accessToken,
      refreshToken,
      userId,
      email,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    };
  }

  async validateAccessToken(token: string): Promise<boolean> {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'access') {
        return false;
      }

      const session = this.sessions.get(token);
      if (!session) {
        return false;
      }

      if (new Date() > session.expiresAt) {
        this.sessions.delete(token);
        return false;
      }

      const user = await this.identityService.findById(payload.sub);
      if (!user) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async getUserFromToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'access') {
        return null;
      }

      const session = this.sessions.get(token);
      if (!session || new Date() > session.expiresAt) {
        return null;
      }

      return {
        userId: payload.sub,
        email: payload.email,
      };
    } catch (error) {
      return null;
    }
  }

  async refreshSession(refreshToken: string): Promise<SessionResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const user = await this.identityService.findById(payload.sub);
      if (!user) {
        throw new Error('Invalid refresh token');
      }

      const oldSession = Array.from(this.sessions.values()).find(
        s => s.refreshToken === refreshToken
      );

      if (oldSession) {
        this.revokeSession(oldSession.accessToken);
      }

      return this.createSession(user.userId, user.email);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async revokeSession(accessToken: string): Promise<void> {
    const session = this.sessions.get(accessToken);
    if (session) {
      const userSessionSet = this.userSessions.get(session.userId);
      if (userSessionSet) {
        userSessionSet.delete(accessToken);
      }
      this.sessions.delete(accessToken);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const userSessionSet = this.userSessions.get(userId);
    if (userSessionSet) {
      for (const accessToken of userSessionSet) {
        this.sessions.delete(accessToken);
      }
      userSessionSet.clear();
    }
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet) {
      return [];
    }

    const sessions: Session[] = [];
    for (const accessToken of userSessionSet) {
      const session = this.sessions.get(accessToken);
      if (session && new Date() < session.expiresAt) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      const session = this.sessions.get(token);
      if (session) {
        const userSessionSet = this.userSessions.get(session.userId);
        if (userSessionSet) {
          userSessionSet.delete(token);
        }
        this.sessions.delete(token);
      }
    }
  }
}
