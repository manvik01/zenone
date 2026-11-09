import { ValidationPipe } from '@nestjs/common';

/** Shared ValidationPipe — whitelist, reject unknown fields, transform payloads. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
}
