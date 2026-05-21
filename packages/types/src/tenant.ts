export type TenantType = 'SHARED' | 'PRIVATE';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'CANCELLED';
export type PlanType = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE' | 'GOVERNMENT';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  type: TenantType;
  status: TenantStatus;
  plan: PlanType;
  vatNumber?: string | null;
  crNumber?: string | null;
  settings?: Record<string, any>;
  features: string[];
  logoUrl?: string | null;
  primaryColor?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface TenantCreateInput {
  name: string;
  slug: string;
  type: TenantType;
  plan: PlanType;
  domain?: string;
  vatNumber?: string;
  crNumber?: string;
}
