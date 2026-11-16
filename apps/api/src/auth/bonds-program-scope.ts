import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor, UnauthorizedException } from '@nestjs/common';
import type { Observable } from 'rxjs';

// A BONDS-sourced session is scoped to ONE purchased app. This table must be
// audited against every SCC route before program-session issuance is enabled.
// Unknown business paths fail closed. Existing SCC380 sessions are unaffected.
export const BONDS_PROGRAM_KEYS = [
  'crm','hr','real_estate','fleet','sales','purchasing',
  'inventory','finance','accounting','projects','governance',
] as const;
export type BondsProgramKey = typeof BONDS_PROGRAM_KEYS[number];
const ALL = new Set<string>(BONDS_PROGRAM_KEYS);

const financeRoutes: Record<string, readonly BondsProgramKey[]> = {
 'finance/payments':['finance'],
 'finance/expenses':['finance'],
 'finance/bank-accounts':['finance'],
 'finance/bank-reconciliation':['finance'],
 'finance/budgets':['finance'],
 'finance/foreign-exchange':['finance','accounting'],
 'finance/vat-returns':['finance','accounting'],
 'finance/financial-periods':['accounting'],
 'finance/chart-of-accounts':['accounting'],
 'finance/journal-entries':['accounting'],
 'finance/accounting-journals':['accounting'],
 'finance/accounting-schedules':['accounting'],
 'finance/year-end-closing':['accounting'],
 'finance/cost-centers':['accounting'],
 'finance/fixed-assets':['accounting'],
 'finance/purchase-orders':['purchasing'],
};

const segment = (path:string,prefix:string) => path===prefix || path.startsWith(prefix+'/');
export function allowedBondsProgramsForRoute(pathname: string, method: string): readonly BondsProgramKey[] {
  if(typeof pathname!=='string' || typeof method!=='string')return [];
  const raw = pathname.split('?')[0].replace(/^\/+/,'').replace(/^api\//,'').replace(/\/+$/,'');
  if(!raw || raw.includes('..')||raw.includes('%')||raw.includes('\\'))return [];
  if(raw==='auth/me' && method==='GET')return BONDS_PROGRAM_KEYS;
  if(segment(raw,'crm'))return ['crm'];
  if(segment(raw,'hr/governance'))return ['hr','governance'];
  if(segment(raw,'hr'))return ['hr'];
  if(segment(raw,'real-estate'))return ['real_estate'];
  if(segment(raw,'fleet'))return ['fleet'];
  if(segment(raw,'erp/invoices'))return ['sales'];
  if(segment(raw,'pos'))return ['sales'];
  if(segment(raw,'supplier') || segment(raw,'supplier-invoices') ||
     segment(raw,'supplier-invoice'))return ['purchasing'];
  if(segment(raw,'stock-transfer') || segment(raw,'inventory'))return ['inventory'];
  if(segment(raw,'projects'))return ['projects'];
  if(segment(raw,'approvals') || segment(raw,'compliance'))return ['governance'];
  if(segment(raw,'zatca'))return ['sales','accounting'];
  for(const [base,programs] of Object.entries(financeRoutes)){
    if(segment(raw,base))return programs;
  }
  // Shared identity/workspace read-only endpoints, subject to existing
  // authenticated SCC role/tenant controls.
  if(method==='GET' && (segment(raw,'branch') || segment(raw,'users') ||
      segment(raw,'tenant')))return BONDS_PROGRAM_KEYS;
  // Generic analytics, reports, integrations, security, queues, websocket,
  // billing, AI and unknown routes need explicit data-level access review.
  return [];
}
export function checkBondsProgramScope(
  scope: { bondsOrigin?:boolean; bondsProgramKey?:string } | null | undefined,
  pathname: string,
  method: string,
): boolean {
  if(!scope?.bondsOrigin)return true; // Never alter SCC native user access.
  if(!scope.bondsProgramKey || !ALL.has(scope.bondsProgramKey))return false;
  return allowedBondsProgramsForRoute(pathname,method).includes(scope.bondsProgramKey as BondsProgramKey);
}

@Injectable()
export class BondsProgramScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const scope = req?.user;
    if(scope?.bondsOrigin && !checkBondsProgramScope(scope,req.originalUrl||req.url,req.method)){
      throw new ForbiddenException('BONDS_PROGRAM_ACCESS_DENIED');
    }
    return next.handle();
  }
}
