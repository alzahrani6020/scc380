import { UserRole } from '@scc/types';

export const RolePermissions = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['tenant:read', 'tenant:write', 'user:read', 'user:write', 'crm:*', 'erp:*', 'hr:*', 'fleet:*', 'analytics:*'],
  MANAGER: ['crm:*', 'erp:read', 'hr:read', 'fleet:*', 'analytics:read'],
  USER: ['crm:read', 'crm:write', 'erp:read'],
  AUDITOR: ['*read'],
  READONLY: ['*read'],
} as const;

export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = (RolePermissions[role] || []) as unknown as string[];
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;
  if (permissions.includes(`${permission.split(':')[0]}:*`)) return true;
  return false;
}
