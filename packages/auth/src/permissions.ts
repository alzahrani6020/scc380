import { UserRole } from '@scc/types';

export const RolePermissions = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['tenant:read', 'tenant:write', 'user:read', 'user:write', 'crm:*', 'erp:*', 'hr:*', 'real-estate:*', 'fleet:*', 'analytics:*', 'notifications:read', 'notifications:self-write', 'notifications:admin'],
  MANAGER: ['crm:*', 'erp:read', 'hr:read', 'hr:employees:read', 'hr:org:read', 'hr:attendance:*', 'hr:contracts:read', 'hr:documents:read', 'hr:loans:read', 'hr:settlements:read', 'hr:lifecycle:*', 'hr:requests:*', 'hr:leave-requests:*', 'hr:leave-admin:read', 'hr:payroll:read', 'hr:assets:read', 'hr:scheduling:*', 'hr:recruitment:read', 'hr:performance:*', 'hr:training:read', 'real-estate:read', 'fleet:*', 'analytics:read', 'notifications:read', 'notifications:self-write', 'notifications:admin'],
  USER: ['crm:read', 'crm:write', 'erp:read', 'notifications:read', 'notifications:self-write'],
  AUDITOR: ['*read'],
  READONLY: ['*read'],
} as const;

export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = (RolePermissions[role] || []) as unknown as string[];
  return permissions.some((p) => {
    if (p === permission) return true;
    if (!p.includes('*')) return false;
    const rx = new RegExp('^' + p.split('*').map(escapeRegExp).join('.*') + '$');
    return rx.test(permission);
  });
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
