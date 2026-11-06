import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * تعقيم هوية الطلب بعد نجاح JWT:
 * يمنع انتحال x-tenant-id / x-user-role القادم من العميل، ويملؤها من req.user (موقّع).
 * يعمل بعد JwtAuthGuard — أي طلب غير موثق لا يصل إليه أصلًا.
 * الطلبات العامة (public) لا تملك req.user فتُترك رؤوسها كما هي (لا تقرأها خدمات عامة).
 */
@Injectable()
export class SanitizeIdentityHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (req.user) {
      if (req.headers) {
        req.headers['x-tenant-id'] = req.user.tenantId ?? '';
        req.headers['x-user-role'] = req.user.role ?? '';
        req.headers['x-branch-id'] = req.headers['x-branch-id'] || '';
      }
      // قيم مكررة يقرأها بعض الكنترولرات من الاستعلام/الجسم
      req.tenantId = req.user.tenantId;
      req.userRole = req.user.role;
    }
    return next.handle();
  }
}
