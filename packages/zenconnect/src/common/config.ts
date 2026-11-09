import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_DEV_JWT_SECRET = 'zenone-dev-secret-change-in-production';
export const PRODUCTION_MIN_JWT_SECRET_LENGTH = 32;
export const DEFAULT_PORT = 3000;

const logger = new Logger('Config');
let warnedDefaultSecret = false;

/**
 * Load packages/zenconnect/.env if present. Existing process.env values win.
 * Prototype-only helper — no extra dotenv dependency.
 */
export function loadEnvFile(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
  ];

  const seen = new Set<string>();
  for (const envPath of candidates) {
    const resolved = path.resolve(envPath);
    if (seen.has(resolved) || !fs.existsSync(resolved)) {
      continue;
    }
    seen.add(resolved);
    applyEnvFile(resolved);
  }
}

function applyEnvFile(envPath: string): void {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * JWT HMAC secret. Production refuses a missing, default, or short secret.
 * Local prototype falls back to a well-known default and logs a warning in development.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (isProduction()) {
    if (!secret || secret === DEFAULT_DEV_JWT_SECRET) {
      throw new Error(
        'JWT_SECRET must be set to a non-default value when NODE_ENV=production',
      );
    }
    if (secret.length < PRODUCTION_MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be at least ${PRODUCTION_MIN_JWT_SECRET_LENGTH} characters when NODE_ENV=production`,
      );
    }
    return secret;
  }

  if (!secret || secret === DEFAULT_DEV_JWT_SECRET) {
    if (isDevelopment() && !warnedDefaultSecret) {
      warnedDefaultSecret = true;
      logger.warn(
        'Using the default JWT secret. Set JWT_SECRET in .env for anything beyond local prototype use.',
      );
    }
    return secret || DEFAULT_DEV_JWT_SECRET;
  }

  return secret;
}

export function getPort(): number {
  const raw = process.env.PORT;
  if (!raw) {
    return DEFAULT_PORT;
  }
  const port = Number.parseInt(raw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    return DEFAULT_PORT;
  }
  return port;
}

/**
 * Prototype default is allow-all (`true` reflects any origin).
 * Set CORS_ORIGIN to a comma-separated list to restrict.
 */
export function getCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw === '*') {
    return true;
  }
  const origins = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    return true;
  }
  return origins.length === 1 ? origins[0] : origins;
}
