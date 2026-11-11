import { UserRole } from '@scc/types';

export const RolePermissions = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['tenant:read', 'tenant:write', 'user:read', 'user:write', 'crm:*', 'erp:*', 'hr:*', 'fleet:*', 'analytics:*', 'notifications:read', 'notifications:self-write', 'notifications:admin'],
  MANAGER: ['crm:*', 'erp:read', 'hr:read', 'fleet:*', 'analytics:read', 'notifications:read', 'notifications:self-write', 'notifications:admin'],
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
