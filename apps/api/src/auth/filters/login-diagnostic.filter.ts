import { ArgumentsHost, Catch, HttpException, Injectable } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

/**
 * Preserve Nest's existing exception semantics. Only annotate POST /auth/login
 * responses with non-sensitive diagnostic metadata so an upstream-generated 429
 * can be distinguished from a Nest-generated 429.
 */
@Injectable()
@Catch()
export class LoginDiagnosticFilter extends BaseExceptionFilter {
  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    if (request?.method === 'POST' && request?.path === '/auth/login') {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      const body = exception instanceof HttpException ? exception.getResponse() : null;
      const payload = body && typeof body === 'object' && !Array.isArray(body)
        ? body as Record<string, unknown> : {};
      const knownCodes = new Set([
        'LOGIN_FAILED_ATTEMPTS', 'LOGIN_CONCURRENT_LIMIT', 'LOGIN_RATE_LIMITED',
      ]);
      const requestedCode = typeof payload.errorCode === 'string' ? payload.errorCode : '';
      const code = status === 429
        ? (knownCodes.has(requestedCode) ? requestedCode : 'LOGIN_RATE_LIMITED')
        : status === 401 ? 'INVALID_CREDENTIALS'
        : status === 400 ? 'INVALID_REQUEST'
        : 'LOGIN_ERROR';
      response.setHeader('X-SCC-Auth-Error-Code', code);
      if (status === 429) {
        const seconds = Number(payload.retryAfter);
        if (Number.isFinite(seconds) && seconds > 0) {
          response.setHeader('Retry-After', String(Math.min(3600, Math.ceil(seconds))));
        }
      }
    }
    super.catch(exception, host);
  }
}
