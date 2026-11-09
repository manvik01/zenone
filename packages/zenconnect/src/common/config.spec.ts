import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_DEV_JWT_SECRET,
  DEFAULT_PORT,
  PRODUCTION_MIN_JWT_SECRET_LENGTH,
  getCorsOrigin,
  getJwtSecret,
  getPort,
  isDevelopment,
  isProduction,
  loadEnvFile,
} from './config';

describe('config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  describe('getJwtSecret', () => {
    it('returns the env secret in non-production', () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'local-test-secret';
      expect(getJwtSecret()).toBe('local-test-secret');
    });

    it('falls back to the known default outside production', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.JWT_SECRET;
      expect(getJwtSecret()).toBe(DEFAULT_DEV_JWT_SECRET);
    });

    it('rejects a missing secret in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET must be set/);
    });

    it('rejects the default secret in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = DEFAULT_DEV_JWT_SECRET;
      expect(() => getJwtSecret()).toThrow(/non-default value/);
    });

    it('rejects a short secret in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'too-short';
      expect(() => getJwtSecret()).toThrow(
        new RegExp(String(PRODUCTION_MIN_JWT_SECRET_LENGTH)),
      );
    });

    it('accepts a long non-default secret in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(PRODUCTION_MIN_JWT_SECRET_LENGTH);
      expect(getJwtSecret()).toBe('a'.repeat(PRODUCTION_MIN_JWT_SECRET_LENGTH));
    });
  });

  describe('environment helpers', () => {
    it('detects production and development', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
      expect(isDevelopment()).toBe(false);

      process.env.NODE_ENV = 'development';
      expect(isProduction()).toBe(false);
      expect(isDevelopment()).toBe(true);
    });
  });

  describe('getPort', () => {
    it('defaults to 3000', () => {
      delete process.env.PORT;
      expect(getPort()).toBe(DEFAULT_PORT);
    });

    it('parses a valid PORT', () => {
      process.env.PORT = '4000';
      expect(getPort()).toBe(4000);
    });

    it('ignores an invalid PORT', () => {
      process.env.PORT = 'nope';
      expect(getPort()).toBe(DEFAULT_PORT);
    });
  });

  describe('getCorsOrigin', () => {
    it('allows all origins by default', () => {
      delete process.env.CORS_ORIGIN;
      expect(getCorsOrigin()).toBe(true);
    });

    it('allows all when CORS_ORIGIN is *', () => {
      process.env.CORS_ORIGIN = '*';
      expect(getCorsOrigin()).toBe(true);
    });

    it('returns a single origin or a list', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3001';
      expect(getCorsOrigin()).toBe('http://localhost:3001');

      process.env.CORS_ORIGIN = 'http://a.example, http://b.example';
      expect(getCorsOrigin()).toEqual([
        'http://a.example',
        'http://b.example',
      ]);
    });
  });

  describe('loadEnvFile', () => {
    it('loads keys without overwriting existing env', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenconnect-env-'));
      const envPath = path.join(dir, '.env');
      fs.writeFileSync(
        envPath,
        'JWT_SECRET=from-file\n# comment\nPORT=9999\nQUOTED="quoted-value"\n',
      );

      process.env.JWT_SECRET = 'already-set';
      delete process.env.PORT;
      delete process.env.QUOTED;

      const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(dir);
      try {
        loadEnvFile();
        expect(process.env.JWT_SECRET).toBe('already-set');
        expect(process.env.PORT).toBe('9999');
        expect(process.env.QUOTED).toBe('quoted-value');
      } finally {
        cwdSpy.mockRestore();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
