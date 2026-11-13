import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { prisma, tenantWhere } from '@scc/database';

const SENSITIVE_FIELDS = new Set([
  'password', 'passwordhash', 'accesstoken', 'refreshtoken', 'resettoken',
  'token', 'authorization', 'twofactorsecret', 'twofactorbackupcodes',
  'backupcodes', 'apikey', 'apikeys', 'secret', 'otp', 'csid',
  'privatekey', 'cookie', 'cookies', 'contentbase64',
]);

export function sanitizeBody(value: any): any {
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

function hasPath(path: string, segment: string): boolean {
  const cleanPath = path.split('?')[0];
  return cleanPath === segment || cleanPath.endsWith(segment) || cleanPath.includes(segment + '/');
}

function getEntityType(path: string): string {
  if (hasPath(path, '/crm/contacts')) return 'CONTACT';
  if (hasPath(path, '/crm/deals')) return 'DEAL';
  if (hasPath(path, '/crm/activities')) return 'ACTIVITY';
  if (hasPath(path, '/hr/employees')) return 'EMPLOYEE';
  if (hasPath(path, '/hr/attendances')) return 'ATTENDANCE';
  if (hasPath(path, '/hr/leaves')) return 'LEAVE';
  if (hasPath(path, '/hr/payrolls')) return 'PAYROLL';
  if (hasPath(path, '/hr/departments')) return 'DEPARTMENT';
  if (hasPath(path, '/hr/shifts')) return 'SHIFT';
  if (hasPath(path, '/hr/contracts')) return 'EMPLOYEE_CONTRACT';
  if (hasPath(path, '/hr/leave-policies')) return 'LEAVE_POLICY';
  if (hasPath(path, '/hr/leave-balances')) return 'LEAVE_BALANCE';
  if (hasPath(path, '/hr/payroll-runs')) return 'PAYROLL_RUN';
  if (hasPath(path, '/notifications')) return 'NOTIFICATION';

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
  if (hasPath(path, '/crm/contacts')) return 'CONTACT_' + suffix;
  if (hasPath(path, '/crm/deals')) return 'DEAL_' + suffix;
  if (hasPath(path, '/crm/activities')) return 'ACTIVITY_' + suffix;
  if (hasPath(path, '/hr/employees')) return 'EMPLOYEE_' + suffix;
  if (hasPath(path, '/hr/attendances')) return 'ATTENDANCE_' + suffix;
  if (hasPath(path, '/hr/leaves')) return 'LEAVE_' + suffix;
  if (hasPath(path, '/hr/payrolls')) return 'PAYROLL_' + suffix;
  if (hasPath(path, '/hr/departments')) return 'DEPARTMENT_' + suffix;
  if (hasPath(path, '/hr/shifts')) return 'SHIFT_' + suffix;
  if (hasPath(path, '/hr/contracts')) return 'EMPLOYEE_CONTRACT_' + suffix;
  if (hasPath(path, '/hr/leave-policies')) return 'LEAVE_POLICY_' + suffix;
  if (hasPath(path, '/hr/leave-balances')) return 'LEAVE_BALANCE_' + suffix;
  if (hasPath(path, '/hr/payroll-runs')) return 'PAYROLL_RUN_' + suffix;
  if (hasPath(path, '/notifications')) return 'NOTIFICATION_' + suffix;
  return method;
}

async function loadPreviousValue(request: any, method: string, path: string) {
  if (!['PATCH', 'PUT', 'DELETE'].includes(method) || !request.params?.id) return null;

  const tenantId =
    request.user?.role === 'SUPER_ADMIN' ? request.tenantId : request.user?.tenantId;
  const where = { id: request.params.id, ...tenantWhere(tenantId) };

  if (hasPath(path, '/crm/contacts')) return prisma.contact.findFirst({ where });
  if (hasPath(path, '/crm/deals')) return prisma.deal.findFirst({ where });
  if (hasPath(path, '/crm/activities')) return prisma.activity.findFirst({ where });
  if (hasPath(path, '/hr/employees')) return prisma.employee.findFirst({ where });
  if (hasPath(path, '/hr/attendances')) return prisma.attendance.findFirst({ where });
  if (hasPath(path, '/hr/leaves')) return prisma.leave.findFirst({ where });
  if (hasPath(path, '/hr/payrolls')) return prisma.payroll.findFirst({ where });
  if (hasPath(path, '/hr/departments')) return prisma.department.findFirst({ where });
  if (hasPath(path, '/hr/shifts')) return prisma.shift.findFirst({ where });
  if (hasPath(path, '/hr/contracts')) return prisma.employeeContract.findFirst({ where });
  if (hasPath(path, '/hr/leave-policies')) return prisma.leavePolicy.findFirst({ where });
  if (hasPath(path, '/hr/leave-balances')) return prisma.leaveBalance.findFirst({ where });
  if (hasPath(path, '/hr/payroll-runs')) return prisma.payrollRun.findFirst({ where });
  if (hasPath(path, '/notifications')) {
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
                    action: deriveAuditAction(method, path) + '_ERROR',
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
