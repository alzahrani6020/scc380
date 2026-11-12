import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { prisma, tenantWhere } from '@scc/database';

const SENSITIVE_FIELDS = new Set([
  'password', 'passwordhash', 'accesstoken', 'refreshtoken', 'resettoken',
  'token', 'authorization', 'twofactorsecret', 'twofactorbackupcodes',
  'backupcodes', 'apikey', 'apikeys', 'secret', 'otp', 'csid',
  'privatekey', 'cookie', 'cookies',
]);

function sanitizeBody(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeBody);
  if (typeof value !== 'object') return value;

  if (typeof value.toJSON === 'function' && value.constructor?.name !== 'Object') {
    return sanitizeBody(value.toJSON());
  }

  const sanitized: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? '***REDACTED***' : sanitizeBody(child);
  }
  return sanitized;
}

function getEntityType(path: string): string {
  if (/\/crm\/contacts\b/.test(path)) return 'CONTACT';
  if (/\/crm\/deals\b/.test(path)) return 'DEAL';
  if (/\/crm\/activities\b/.test(path)) return 'ACTIVITY';
  if (/\/hr\/employees\b/.test(path)) return 'EMPLOYEE';
  if (/\/hr\/attendances\b/.test(path)) return 'ATTENDANCE';
  if (/\/hr\/leaves\b/.test(path)) return 'LEAVE';
  if (/\/hr\/payrolls\b/.test(path)) return 'PAYROLL';
  if (/\/hr\/departments\b/.test(path)) return 'DEPARTMENT';
  if (/\/hr\/shifts\b/.test(path)) return 'SHIFT';
  if (/\/notifications\b/.test(path)) return 'NOTIFICATION';

  const segments = path.split('/').filter(Boolean);
  const idx = segments.findIndex((s) =>
    ['auth', 'zatca', 'erp', 'crm', 'hr', 'finance', 'fleet', 'inventory', 'analytics', 'government', 'projects', 'alerts', 'templates', 'users', 'settings', 'billing', 'compliance'].includes(s),
  );
  return idx >= 0 ? segments[idx].toUpperCase() : 'UNKNOWN';
}

export function deriveAuditAction(method: string, path: string): string {
  const verbs: Record<string, string> = { POST: 'CREATED', PATCH: 'UPDATED', PUT: 'UPDATED', DELETE: 'DELETED' };
  const suffix = verbs[method];
  if (!suffix) return method;
  if (/\/crm\/contacts\b/.test(path)) return `CONTACT_${suffix}`;
  if (//crm/deals/.test(path)) return `DEAL_${suffix}`;
  if (//crm/activities/.test(path)) return `ACTIVITY_${suffix}`;
  if (//hr/employees/.test(path)) return `EMPLOYEE_${suffix}`;
  if (//hr/attendances/.test(path)) return `ATTENDANCE_${suffix}`;
  if (//hr/leaves/.test(path)) return `LEAVE_${suffix}`;
  if (//hr/payrolls/.test(path)) return `PAYROLL_${suffix}`;
  if (//hr/departments/.test(path)) return `DEPARTMENT_${suffix}`;
  if (//hr/shifts/.test(path)) return `SHIFT_${suffix}`;
  if (//notifications/.test(path)) return `NOTIFICATION_${suffix}`;
  return method;
}

async function loadPreviousValue(request: any, method: string, path: string) {
  if (!['PATCH', 'PUT', 'DELETE'].includes(method) || !request.params?.id) return null;

  const tenantId =
    request.user?.role === 'SUPER_ADMIN' ? request.tenantId : request.user?.tenantId;
  const where = { id: request.params.id, ...tenantWhere(tenantId) };

  if (//crm/contacts/.test(path)) return prisma.contact.findFirst({ where });
  if (//crm/deals/.test(path)) return prisma.deal.findFirst({ where });
  if (//crm/activities/.test(path)) return prisma.activity.findFirst({ where });
  if (//hr/employees/.test(path)) return prisma.employee.findFirst({ where });
  if (//hr/attendances/.test(path)) return prisma.attendance.findFirst({ where });
  if (//hr/leaves/.test(path)) return prisma.leave.findFirst({ where });
  if (//hr/payrolls/.test(path)) return prisma.payroll.findFirst({ where });
  if (//hr/departments/.test(path)) return prisma.department.findFirst({ where });
  if (//hr/shifts/.test(path)) return prisma.shift.findFirst({ where });
  if (//notifications/.test(path)) {
    const notificationWhere: any = { ...where };
    if (request.user?.role !== 'SUPER_ADMIN') notificationWhere.userId = request.user?.userId;
    return prisma.notification.findFirst({ where: notificationWhere });
  }
  return null;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user = request.user;
    const tenantId = user?.role === 'SUPER_ADMIN'
      ? request.tenantId || user?.tenantId || null
      : user?.tenantId || null;
    const userId = user?.userId || user?.sub || user?.id || null;
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const method = request.method;
    const path = request.originalUrl || request.url;
    const body = sanitizeBody(request.body);
    const entityType = getEntityType(path);

    return from(loadPreviousValue(request, method, path)).pipe(
      switchMap((previous) =>
        next.handle().pipe(
          tap({
            next: async (data) => {
              if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
              try {
                await prisma.auditLog.create({
                  data: {
                    tenantId,
                    userId,
                    action: deriveAuditAction(method, path),
                    entityType,
                    entityId: request.params?.id || data?.id || body?.id || null,
                    oldValues: previous ? sanitizeBody(previous) : null,
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
                    action: `${deriveAuditAction(method, path)}_ERROR`,
                    entityType,
                    entityId: request.params?.id || body?.id || null,
                    oldValues: previous ? sanitizeBody(previous) : { error: error.message, statusCode: error.status },
                    newValues: null,
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
        ),
      ),
    );
  }
}
