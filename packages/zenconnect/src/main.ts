import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getCorsOrigin, getJwtSecret, getPort, loadEnvFile } from './common/config';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { createValidationPipe } from './common/validation.pipe';

async function bootstrap() {
  loadEnvFile();
  getJwtSecret();

  const app = await NestFactory.create(AppModule);
  const logger = new Logger('ZenConnect');

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Prototype CORS: allow all origins by default. Restrict with CORS_ORIGIN.
  // Rate limiting is not implemented; see docs/PRODUCTION.md.
  app.enableCors({ origin: getCorsOrigin() });

  const port = getPort();
  await app.listen(port);

  logger.log(`ZenConnect is running on http://localhost:${port}`);
  logger.log(`Health check: http://localhost:${port}/health`);
}

bootstrap();
