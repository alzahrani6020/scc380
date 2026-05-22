import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { prisma } from '@scc/database';

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'secret', 'otp', 'csid', 'privateKey'];

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const sanitized: any = Array.isArray(body) ? [...body] : { ...body };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeBody(sanitized[key]);
    }
  }
  return sanitized;
}

function getEntityType(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const idx = segments.findIndex((s) =>
    ['auth', 'zatca', 'erp', 'crm', 'hr', 'finance', 'fleet', 'inventory', 'analytics', 'government', 'projects', 'notifications', 'alerts', 'templates', 'users', 'settings', 'billing'].includes(s),
  );
  return idx >= 0 ? segments[idx].toUpperCase() : 'UNKNOWN';
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user = request.user;
    const tenantId = user?.tenantId || null;
    const userId = user?.userId || user?.sub || null;
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const method = request.method;
    const path = request.originalUrl || request.url;
    const body = sanitizeBody(request.body);
    const entityType = getEntityType(path);

    return next.handle().pipe(
      tap({
        next: async (data) => {
          if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
          try {
            await prisma.auditLog.create({
              data: {
                tenantId,
                userId,
                action: method,
                entityType,
                entityId: request.params?.id || body?.id || null,
                newValues: typeof data === 'object' ? sanitizeBody(data) : null,
                ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
                userAgent: typeof userAgent === 'string' ? userAgent : null,
                httpMethod: method,
                httpPath: path,
                requestBody: Object.keys(body || {}).length > 0 ? body : null,
                responseStatus: response.statusCode,
              },
            });
          } catch (e) {
            console.error('Audit log failed:', e);
          }
        },
        error: async (error) => {
          if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
          try {
            await prisma.auditLog.create({
              data: {
                tenantId,
                userId,
                action: `${method}_ERROR`,
                entityType,
                entityId: request.params?.id || body?.id || null,
                oldValues: { error: error.message, statusCode: error.status },
                ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
                userAgent: typeof userAgent === 'string' ? userAgent : null,
                httpMethod: method,
                httpPath: path,
                requestBody: Object.keys(body || {}).length > 0 ? body : null,
                responseStatus: error.status || 500,
              },
            });
          } catch (e) {
            console.error('Audit log failed:', e);
          }
        },
      }),
    );
  }
}
