import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function mockHost(url = '/v1/auth/login') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const originalEnv = process.env.NODE_ENV;
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter = new HttpExceptionFilter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('returns HttpException payload without a stack outside development', () => {
    process.env.NODE_ENV = 'production';
    const { host, status, json } = mockHost();

    filter.catch(new BadRequestException('Invalid email'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = json.mock.calls[0][0];
    expect(body.message).toEqual('Invalid email');
    expect(body.statusCode).toBe(400);
    expect(body.stack).toBeUndefined();
    expect(body.path).toBe('/v1/auth/login');
    expect(body.timestamp).toBeDefined();
  });

  it('hides unexpected error details and stacks outside development', () => {
    process.env.NODE_ENV = 'production';
    const { host, status, json } = mockHost('/v1/transfers/x');

    filter.catch(new Error('secret internal boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('secret internal boom');
  });

  it('includes stack traces in development', () => {
    process.env.NODE_ENV = 'development';
    const { host, json } = mockHost();
    const err = new Error('visible in dev');

    filter.catch(err, host);

    const body = json.mock.calls[0][0];
    expect(body.message).toBe('visible in dev');
    expect(body.stack).toContain('visible in dev');
  });

  it('includes HttpException stacks only in development', () => {
    process.env.NODE_ENV = 'development';
    const { host, json } = mockHost();

    filter.catch(new BadRequestException('nope'), host);

    const body = json.mock.calls[0][0];
    expect(body.stack).toBeDefined();
  });
});
