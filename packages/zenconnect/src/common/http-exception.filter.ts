import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { isDevelopment } from './config';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const showStack = isDevelopment();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      statusCode: status,
      message: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        body = { statusCode: status, message: payload };
      } else {
        body = { ...(payload as Record<string, unknown>), statusCode: status };
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      body = {
        statusCode: status,
        message: showStack ? exception.message : 'Internal server error',
      };
      if (showStack) {
        body.stack = exception.stack;
      }
    } else {
      this.logger.error('Unhandled non-error exception');
    }

    if (showStack && exception instanceof HttpException && exception.stack) {
      body.stack = exception.stack;
    }

    if (!showStack) {
      delete body.stack;
    }

    body.timestamp = new Date().toISOString();
    body.path = request.url;

    response.status(status).json(body);
  }
}
